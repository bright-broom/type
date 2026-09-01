# TypeLoop

1日60秒で正確さとリズムを育てる、日本語ローマ字タイピング練習アプリです。

## Features

- Incremental Japanese romanization matching
- Deterministic score, WPM, CPM, accuracy, miss, and combo calculation
- Drift-resistant 60-second session timer with pause and resume
- Local-first personal best, history, weak-key analysis, and settings
- Excel由来のConsulting Playbook全17セクション検索と327件の用語練習
- 令和8年度向け宅建用語446語の検索・分野/重要度/出典フィルター・用語練習
- 宅建10問演習と50問/45問の本番模試、見直し・時間切れ提出・再読み込み復旧・端末内履歴・弱点優先出題
- Keyboard-first operation, IME protection, reduced motion, and optional sound
- スマホ対応入力：開始タップと同時にソフトウェアキーボードが開き、キーボードが覆う高さに合わせて出題・ローマ字ガイド・入力欄を保持。かな入力時は英数字への切り替えを案内（ミス加算はしない）

## Development

Node.js 22.13以降が必要です。

```bash
npm ci
npm run e2e:install
npm run dev
```

ローカルでは `http://localhost:3000/` を開きます。

実装前に [`AGENTS.md`](AGENTS.md) を入口として、必要に応じて
[`docs/architecture.md`](docs/architecture.md) と
[`docs/directory-structure.md`](docs/directory-structure.md) を参照してください。
変更の提出手順は [`CONTRIBUTING.md`](CONTRIBUTING.md) に従い、`main`へ直接pushしないでください。

## Quality gates

```bash
npm run check:quick
npm run check
npm run check:ci
```

`check:quick` は開発中の format・lint・typecheck・unit・integration、`check` は coverage・dead-code・production build・Playwright E2E まで実行します。`check:ci` はさらに tracked-secret scan と High 以上の依存脆弱性を検査します。詳細は [`docs/quality-harness.md`](docs/quality-harness.md)、設計判断は [`docs/adr`](docs/adr) に記録しています。

## Review workflow

PRレビューはCodeRabbitなどの外部レビューボットに依存しません。実装後は次の順序で確認します。

1. `npm run check:ci` で機械的な品質ゲートを通す
2. `.agents/skills/review-typeloop` を使い、コードを編集しない独立レビュアーに差分を確認させる
3. [`AGENTS.md`](AGENTS.md) のCode Review Rulesに沿って、互換性・依存境界・local-first制約を確認する
4. Critical / High finding を修正し、初回レビュー後は最大2回まで修正・再レビューを行う
5. feature branch だけを GitHub へ push して PR を作成する。PR 更新では Full CI は自動実行されない
6. Merge 前に Actions の `CI` から `Run workflow` を選び、最新 Commit SHA を入力して `Full CI` を 1 回実行する
7. `Full CI` が同じ最新 SHA で成功したことを確認しても Merge せず、人間の最終判断へ引き渡す

AIレビューは、CIで判定できないリポジトリ固有のリスクを補完するために使います。自動生成された指摘だけをマージ判断の根拠にはしません。

## Deployment

This is a standard Next.js App Router application and can be deployed to Vercel with the framework preset set to **Next.js**. No output directory override is required. Git-connected automatic deployment is limited to `main`; create a Preview only when needed from the Vercel Dashboard using an exact Git reference. See [`docs/manual-ci-cd.md`](docs/manual-ci-cd.md).

## Architecture

```text
app/                         Next.js routes and metadata
src/
├── presentation/            React components and browser-facing hooks
├── application/             Typing/assessment session orchestration, state, and ports
├── domain/                  Pure typing, assessment, scoring, prompt, and analytics rules
├── infrastructure/          Browser adapters for audio and persistence
└── content/                 Authored loaders and generated learning content
```

依存方向と各層の責務は [`docs/architecture.md`](docs/architecture.md) を正とします。境界違反と配置ルールはテストで機械的に検出します。タイピング履歴、宅建試験履歴、設定は端末内にのみ保存されます。

## Content import

元ブックを更新した場合は、次のように全シートを再取込できます。

```bash
npm run import:consulting -- "/path/to/Consulting_Playbook_Dictionary_JA.xlsx"
npm run import:takken -- "/path/to/takken-glossary.tsv"
npm run import:git
```

生成物は `src/content/generated/` に出力されます。生成JSONを直接編集せず、取込スクリプトを再実行してください。取込データはローカル静的データとして保持され、外部へ送信されません。

機密資料、個人情報、仮名化された取引・会議データは、取込元だけでなく生成物も公開リポジトリやブラウザ配信物へ含めません。公開データ境界は [ADR-024](docs/adr/ADR-024-public-release-privacy-boundary.md) を正とします。
