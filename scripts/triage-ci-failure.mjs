#!/usr/bin/env node
/**
 * Classify a failed CI log into a verdict a reviewer can act on.
 *
 * CI already reported today's dependency conflicts correctly, but the reason sat
 * inside a job log and the pull requests were merged anyway. This turns a failure
 * into a short comment that names the cause, says whether it is mechanically
 * fixable, and gives the command to run.
 *
 * Usage: triage-ci-failure.mjs [log-file]   (reads stdin when no file is given)
 */

import { readFileSync } from "node:fs";

const MAX_EVIDENCE_LINES = 12;

/**
 * `fixable` means a formatter or linter can produce the change without judgement.
 * Everything else needs a person, so the autofix workflow must not touch it.
 * `blocking` means the failure must never be merged, whatever the reviewer decides.
 */
const RULES = [
  {
    id: "dependency-pins",
    title: "依存ピンの非互換",
    fixable: false,
    blocking: true,
    detect: (log) => log.includes("Incompatible dependency pins:"),
    evidence: (log) => grepAfter(log, "Incompatible dependency pins:", /requires .* but .* is pinned to/),
    advice: "ピンを戻すか、制約側もまとめて上げてください。マージ不可です。",
  },
  {
    id: "eresolve",
    title: "依存解決の失敗 (ERESOLVE)",
    fixable: false,
    blocking: true,
    detect: (log) => log.includes("code ERESOLVE"),
    evidence: (log) => grep(log, /(While resolving|Found:|Could not resolve|Conflicting peer|peerOptional )/),
    advice: "`npm run check:deps` で衝突を特定してからピンを調整してください。マージ不可です。",
  },
  {
    id: "format",
    title: "フォーマット崩れ",
    fixable: true,
    detect: (log) => /Code style issues found/.test(log),
    evidence: (log) => grep(log, /^\[warn\]/),
    advice: "`npm run format` を実行してください。",
  },
  {
    id: "lint",
    title: "Lint エラー",
    fixable: true,
    detect: (log) => /\d+ problems? \(\d+ error/.test(log),
    evidence: (log) => grep(log, /\d+ problems? \(|^\s+\d+:\d+\s+error/),
    advice: "`npx eslint . --fix` で自動修正できる範囲を当ててください。",
  },
  {
    id: "typecheck",
    title: "型エラー",
    fixable: false,
    detect: (log) => /error TS\d+/.test(log),
    evidence: (log) => grep(log, /error TS\d+/),
    advice: "型の修正には判断が必要なので自動修正しません。",
  },
  {
    id: "unit",
    title: "テスト失敗",
    fixable: false,
    detect: (log) => /failing tests/.test(log) || /^not ok /m.test(log),
    evidence: (log) => grep(log, /^not ok |AssertionError/),
    advice: "失敗したテストの原因を調べてください。自動修正しません。",
  },
  {
    id: "coverage",
    title: "カバレッジ閾値割れ",
    fixable: false,
    detect: (log) => /ERROR: Coverage for/.test(log),
    evidence: (log) => grep(log, /ERROR: Coverage for/),
    advice: "テストを追加してください。",
  },
  {
    id: "e2e",
    title: "ブラウザE2Eの失敗",
    fixable: false,
    detect: (log) => /\d+ failed/.test(log) && /playwright|typeloop\.spec/.test(log),
    evidence: (log) => grep(log, /\d+ failed|typeloop\.spec\.ts:\d+/),
    advice: "`playwright-failure-evidence` アーティファクトのスクリーンショットとトレースを確認してください。",
  },
  {
    id: "secrets",
    title: "シークレット検出",
    fixable: false,
    blocking: true,
    detect: (log) => log.includes("Potential secrets detected"),
    evidence: (log) => grep(log, /^- .*: (tracked secret-bearing filename|possible )/),
    advice: "該当ファイルを追跡から外し、値を無効化してください。マージ不可です。",
  },
  {
    id: "audit",
    title: "依存の脆弱性",
    fixable: false,
    blocking: true,
    detect: (log) => /found \d+ (high|critical) severity/.test(log),
    evidence: (log) => grep(log, /severity vulnerabilit/),
    advice: "該当依存を更新してください。マージ不可です。",
  },
  {
    id: "dead-code",
    title: "未使用コード検出",
    fixable: false,
    detect: (log) => /Unused (files|dependencies|exports)/.test(log),
    evidence: (log) => grep(log, /Unused (files|dependencies|exports)/),
    advice: "参照を追加するか削除してください。",
  },
];

const JOB_STEP_PREFIX = /^[^\t]*\t[^\t]*\t/;
const BYTE_ORDER_MARK = /^\uFEFF/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/;
// Built from a char code so the escape sequence itself stays out of the source.
const ANSI_COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Strip the runner's job/step prefix, timestamp, BOM, colour codes and npm label. */
function clean(line) {
  return line
    .replace(JOB_STEP_PREFIX, "")
    .replace(BYTE_ORDER_MARK, "")
    .replace(TIMESTAMP, "")
    .replace(ANSI_COLOUR, "")
    .replace(/^npm (?:error|warn) /, "")
    .trimEnd();
}

function grep(log, pattern) {
  const matches = log
    .split(/\r?\n/)
    .map(clean)
    .filter((line) => line !== "" && pattern.test(line));
  return [...new Set(matches)].slice(0, MAX_EVIDENCE_LINES);
}

function grepAfter(log, marker, pattern) {
  const lines = log.split(/\r?\n/).map(clean);
  const start = lines.findIndex((line) => line.includes(marker));
  if (start < 0) return [];
  return lines
    .slice(start)
    .filter((line) => pattern.test(line))
    .slice(0, MAX_EVIDENCE_LINES);
}

export function triage(log) {
  const matched = RULES.filter((rule) => rule.detect(log));
  const out = ["## CI 失敗のトリアージ", ""];

  if (matched.length === 0) {
    out.push(
      "既知のパターンに一致しませんでした。ログを直接確認してください。",
      "",
      "_分類器は `scripts/triage-ci-failure.mjs` の `RULES` で拡張できます。_",
    );
    return { markdown: out.join("\n"), matched, blocking: false, fixable: false };
  }

  const fixable = matched.every((rule) => rule.fixable);
  const blocking = matched.some((rule) => rule.blocking);
  out.push(
    blocking
      ? "**マージ不可**: 判断が必要な失敗が含まれています。"
      : fixable
        ? "全て機械的に修正可能です。autofix が同じPRへ修正を push します。"
        : "一部は自動修正できません。下記を確認してください。",
    "",
  );
  for (const rule of matched) {
    out.push(`### ${rule.title} ${rule.fixable ? "（自動修正可）" : "（要判断）"}`, "");
    const evidence = rule.evidence(log);
    if (evidence.length > 0) out.push("```text", ...evidence, "```", "");
    out.push(rule.advice, "");
  }
  return { markdown: out.join("\n"), matched, blocking, fixable };
}

if (import.meta.filename === process.argv[1]) {
  const result = triage(readFileSync(process.argv[2] ?? 0, "utf8"));
  process.stdout.write(`${result.markdown}\n_🤖 TypeLoop deterministic CI triage_\n`);
  process.exit(result.blocking ? 2 : 0);
}
