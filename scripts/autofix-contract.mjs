#!/usr/bin/env node

import { readFileSync } from "node:fs";

export function autofixArtifactName(pullRequestNumber, headSha) {
  if (!/^\d+$/.test(String(pullRequestNumber)) || !/^[a-f0-9]{40}$/.test(headSha)) {
    throw new Error("Autofix artifact identity is invalid");
  }
  return `autofix-${pullRequestNumber}-${headSha}`;
}

export function assertCurrentHead(expectedSha, currentSha, state) {
  if (state !== "open") throw new Error(`Pull request is ${state || "in an unknown state"}`);
  if (expectedSha !== currentSha) throw new Error(`Pull request advanced from ${expectedSha} to ${currentSha}`);
}

export function validateModifiedPatch(nameStatus, allowedPaths) {
  const tokens = nameStatus.toString("utf8").split("\0");
  if (tokens.at(-1) === "") tokens.pop();
  if (tokens.length === 0 || tokens.length % 2 !== 0) throw new Error("Autofix patch has invalid name-status data");
  const allowed = new Set(allowedPaths);
  const paths = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const status = tokens[index];
    const path = tokens[index + 1];
    if (status !== "M") throw new Error(`Autofix patch contains forbidden ${status} entry: ${path}`);
    if (!allowed.has(path)) throw new Error(`Autofix patch reaches outside pull request files: ${path}`);
    paths.push(path);
  }
  return paths;
}

function runCli([command, ...args]) {
  if (command === "artifact") return autofixArtifactName(args[0], args[1]);
  if (command === "head") {
    assertCurrentHead(args[0], args[1], args[2]);
    return "ok";
  }
  if (command === "patch") {
    validateModifiedPatch(readFileSync(args[0]), JSON.parse(readFileSync(args[1], "utf8")));
    return "ok";
  }
  throw new Error(`Unknown Autofix contract command: ${command ?? ""}`);
}

if (import.meta.filename === process.argv[1]) {
  try {
    process.stdout.write(`${runCli(process.argv.slice(2))}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
