import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { publicContentViolations } from "./public-content-policy.mjs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const violations = [];
for (const path of files) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;
  const codes = publicContentViolations(path, content);
  if (codes.length > 0) violations.push(`${path}: ${codes.join(", ")}`);
}

if (violations.length > 0) {
  console.error(`Public delivery content violates the confidentiality boundary:\n${violations.join("\n")}`);
  process.exit(1);
}

console.log(`Verified the public-content boundary across ${files.length} repository files.`);
