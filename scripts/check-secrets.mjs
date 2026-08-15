import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const git = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" });
if (git.status !== 0) {
  console.error(git.stderr || "Unable to enumerate tracked files.");
  process.exit(1);
}

const ignored = [/^public\/og\.png$/];
const forbiddenNames = [/(^|\/)\.env($|\.)/, /\.(?:pem|p12|pfx|key)$/i, /(^|\/)(?:id_rsa|id_ed25519)$/];
const signatures = [
  ["private key", new RegExp(Buffer.from("QkVHSU5bXlxuXXswLDQwfVBSSVZBVEUgS0VZ", "base64").toString("utf8"))],
  ["GitHub token", new RegExp(["gh", "p_[A-Za-z0-9]{30,}"].join(""))],
  ["GitHub fine-grained token", new RegExp(["github", "_pat_[A-Za-z0-9_]{40,}"].join(""))],
  ["AWS access key", new RegExp(["AK", "IA[0-9A-Z]{16}"].join(""))],
  ["Slack token", new RegExp(["xo", "x[baprs]-[A-Za-z0-9-]{20,}"].join(""))],
  ["Google API key", new RegExp(["AI", "za[0-9A-Za-z_-]{30,}"].join(""))],
  ["OpenAI-style key", new RegExp(["s", "k-[A-Za-z0-9_-]{32,}"].join(""))],
];
const findings = [];

for (const file of git.stdout.split("\0").filter(Boolean)) {
  if (!existsSync(file)) continue;
  if (ignored.some((pattern) => pattern.test(file))) continue;
  if (forbiddenNames.some((pattern) => pattern.test(file))) {
    findings.push(`${file}: tracked secret-bearing filename`);
    continue;
  }
  const content = readFileSync(file);
  if (content.includes(0)) continue;
  const text = content.toString("utf8");
  for (const [label, pattern] of signatures) {
    if (pattern.test(text)) findings.push(`${file}: possible ${label}`);
  }
}

if (findings.length > 0) {
  console.error("Potential secrets detected:\n" + findings.map((finding) => `- ${finding}`).join("\n"));
  process.exit(1);
}

console.log("Working-tree secret scan passed.");
