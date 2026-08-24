import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
const validModes = new Set(["unit", "integration", "coverage"]);

if (!validModes.has(mode)) {
  console.error("Usage: node scripts/run-node-tests.mjs <unit|integration|coverage>");
  process.exit(2);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = walk("src");
const appTests = walk("app").filter((path) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(path));
if (appTests.length > 0) {
  console.error(`Co-located Node tests belong under src; app tests are unsupported:\n${appTests.join("\n")}`);
  process.exit(2);
}

const unsupportedTests = sourceFiles.filter((path) => /\.(?:test|spec)\.tsx$/.test(path));
if (unsupportedTests.length > 0) {
  console.error(`Node's strip-types runner cannot execute TSX tests:\n${unsupportedTests.join("\n")}`);
  process.exit(2);
}

const sourceTests = sourceFiles.filter((path) => /\.(?:test|spec)\.ts$/.test(path));
const repositoryTests = walk("tests").filter((path) => extname(path) === ".mjs" && path.endsWith(".test.mjs"));
const scriptTests = walk("scripts").filter((path) => extname(path) === ".mjs" && path.endsWith(".test.mjs"));
const integrationPattern = /\.integration\.(?:test|spec)\.ts$/;
const unitTests = sourceTests.filter((path) => !integrationPattern.test(path));
const integrationTests = [
  ...sourceTests.filter((path) => integrationPattern.test(path)),
  ...repositoryTests,
  ...scriptTests,
];
if (unitTests.length === 0 || integrationTests.length === 0) {
  console.error("Test discovery requires at least one unit test and one integration/repository test.");
  process.exit(2);
}
const files =
  mode === "unit"
    ? unitTests
    : mode === "integration"
      ? integrationTests
      : [...sourceTests, ...repositoryTests, ...scriptTests];
const args = ["--experimental-strip-types"];

if (mode === "coverage") {
  const c8 = fileURLToPath(import.meta.resolve("c8/bin/c8.js"));
  const coverageArgs = [
    "--all",
    "--include=src/**/*.ts",
    "--include=src/**/*.tsx",
    "--exclude=src/**/*.test.ts",
    "--exclude=src/**/*.spec.ts",
    "--exclude=src/content/generated/**",
    "--exclude=src/**/*-types.ts",
    "--exclude=src/application/ports/**",
    "--exclude=src/application/session/session-events.ts",
    "--exclude=src/domain/typing/typing-matcher.ts",
    "--check-coverage",
    "--lines=40",
    "--functions=55",
    "--branches=69",
    "--statements=40",
    process.execPath,
    ...args,
    "--test",
    ...files.sort(),
  ];
  const result = spawnSync(process.execPath, [c8, ...coverageArgs], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

args.push("--test", ...files.sort());

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
