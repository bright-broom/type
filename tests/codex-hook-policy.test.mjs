import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const HOOK = new URL(".codex/hooks/pre_tool_use_policy.py", ROOT);

function repository(branch) {
  const cwd = mkdtempSync(join(tmpdir(), "typeloop-hook-"));
  execFileSync("git", ["init", "--initial-branch", branch], { cwd, stdio: "ignore" });
  return cwd;
}

function decision(command, branch = "codex/test") {
  const cwd = repository(branch);
  const result = spawnSync("python3", [HOOK.pathname], {
    cwd,
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
      cwd,
    }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

test("allows ordinary feature-branch development and PR creation", () => {
  assert.equal(decision("git push -u origin codex/safe"), null);
  assert.equal(decision("npm run check:ci && gh pr create --fill"), null);
  assert.equal(decision("echo gh pr merge"), null);
  assert.equal(decision("printf '%s\\n' 'git push origin main'"), null);
});

test("blocks explicit and implicit protected-branch pushes", () => {
  for (const command of [
    "git push origin main",
    "env git push origin main",
    "git push --force-with-lease origin HEAD:refs/heads/main",
    "git push origin codex/work:master",
    "bash -c 'git push origin main'",
    "git push origin $TARGET_BRANCH",
    "git push origin HEAD:$(printf main)",
    "git push origin HEAD:`printf main`",
    "git push --mirror origin",
    "true | git push origin main",
  ]) {
    assert.equal(decision(command)?.permissionDecision, "deny", command);
  }
  assert.equal(decision("git push", "main")?.permissionDecision, "deny");
  assert.equal(decision("git push", "codex/work"), null);
  assert.equal(decision("git push origin main:codex/copied", "codex/work"), null);
});

test("inspects the repository selected by git -C and wrapped push commands", () => {
  const featureRepository = repository("codex/work");
  const protectedRepository = repository("main");
  for (const command of [
    `git -C ${protectedRepository} push`,
    `eval 'git -C ${protectedRepository} push'`,
    `env -C ${protectedRepository} git push`,
    `env --chdir=${protectedRepository} git push`,
    `env -S 'git -C ${protectedRepository} push'`,
    `cd ${protectedRepository} && git push`,
    `(cd ${protectedRepository}; git push)`,
    "git --git-dir=/unresolved push",
  ]) {
    const result = spawnSync("python3", [HOOK.pathname], {
      cwd: featureRepository,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command },
        cwd: featureRepository,
      }),
      encoding: "utf8",
    });
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny", command);
  }

  const result = spawnSync("python3", [HOOK.pathname], {
    cwd: protectedRepository,
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: `(cd ${featureRepository}); git push` },
      cwd: protectedRepository,
    }),
    encoding: "utf8",
  });
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny");

  for (const command of [
    `cd ${featureRepository} | true; git push`,
    `cd ${featureRepository} & git push`,
    `false && cd ${featureRepository}; git push`,
    `true || cd ${featureRepository}; git push`,
    `if false; then cd ${featureRepository}; fi; git push`,
  ]) {
    const compound = spawnSync("python3", [HOOK.pathname], {
      cwd: protectedRepository,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command },
        cwd: protectedRepository,
      }),
      encoding: "utf8",
    });
    assert.equal(JSON.parse(compound.stdout).hookSpecificOutput.permissionDecision, "deny", command);
  }
});

test("blocks every merge and production mutation path", () => {
  for (const command of [
    "gh pr merge 37 --squash",
    "exec gh pr merge 37 --squash",
    "exec -a release gh pr merge 37 --squash",
    "command exec gh pr merge 37 --squash",
    "builtin exec gh pr merge 37 --squash",
    "gh --repo bright-broom/type pr merge 37 --squash",
    "gh pr --repo bright-broom/type merge 37 --squash",
    "gh api --method PUT repos/bright-broom/type/pulls/37/merge",
    "gh api --method PUT repos/bright-broom/type/pulls/$PR/merge",
    "gh api --method PUT repos/bright-broom/type/pulls/$(printf 37)/merge",
    "curl -X PATCH https://api.github.com/repos/bright-broom/type/git/refs/heads/main",
    "gh api --method PATCH repos/bright-broom/type/git/refs/heads/$BRANCH",
    "curl -X PATCH https://api.github.com/repos/bright-broom/type/git/refs/heads/%6d%61%69%6e",
    "vercel promote preview.example.test",
    "vercel deploy",
    "vercel deploy --prod=true",
    "vercel alias set preview.example.test production.example.test",
    "vercel remove project --yes",
    "npx vercel@59.1.4 deploy --prod",
    "exec vercel deploy --prod",
    "nice gh pr merge 38 --squash",
    "nice $(printf git) push origin main",
    "timeout 10 gh pr merge 38 --squash",
    "timeout 10 $(printf gh) pr merge 38 --squash",
    "setsid gh pr merge 38 --squash",
    "xargs gh pr merge 38 --squash",
    "xargs $(printf gh) pr merge 38 --squash",
    'xargs sh -c "gh pr merge 38 --squash"',
    "find . -exec gh pr merge 38 --squash {} \\;",
    "find . -exec $(printf gh) pr merge 38 --squash {} \\;",
    'nice sh -c "gh pr merge 38 --squash"',
    "vercel rollback",
    "true & gh pr merge 37 --squash",
    "echo $(vercel deploy)",
    "bash -lc 'gh pr merge 37 --squash'",
    "(gh pr merge 37 --squash)",
    "{ gh pr merge 37 --squash; }",
    "if true; then gh pr merge 37 --squash; fi",
    'bash -c \'bash -c "bash -c \\"bash -c \\\\\\"gh pr merge 37 --squash\\\\\\"\\""\'',
  ]) {
    assert.equal(decision(command)?.permissionDecision, "deny", command);
  }
  assert.equal(decision("exec git push origin main")?.permissionDecision, "deny");
  assert.equal(decision("vercel build")?.permissionDecision, "deny");
  assert.equal(decision("vercel inspect preview.example.test")?.permissionDecision, "deny");
});

test("malformed hook input fails closed", () => {
  const result = spawnSync("python3", [HOOK.pathname], { input: "not-json", encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny");
});
