import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(repositoryRoot, "src/content/git/git-command-list-v2.55.0.txt");
const outputPath = resolve(repositoryRoot, "src/content/generated/git-commands.json");
const SOURCE_VERSION = "2.55.0";
const SOURCE_URL = "https://raw.githubusercontent.com/git/git/v2.55.0/command-list.txt";
const RETRIEVED_ON = "2026-08-19";
const EXPECTED_COMMAND_COUNT = 161;
const EXPECTED_SOURCE_FILE_SHA256 = "74f660860cfc4b6e4939f8fd64749dd495a43bf0a8be464298a896111313ad66";
const SHORT_MAIN_COMMAND_MAX_LENGTH = 12;
const COMMAND_LIST_MARKER = "### command list (do not change this line)";

const SOURCE_CATEGORIES = [
  "mainporcelain",
  "ancillarymanipulators",
  "ancillaryinterrogators",
  "foreignscminterface",
  "plumbingmanipulators",
  "plumbinginterrogators",
  "synchingrepositories",
  "synchelpers",
  "purehelpers",
];
const OUTPUT_CATEGORIES = [...SOURCE_CATEGORIES, "alias"];

const CATEGORY_DIFFICULTY = {
  mainporcelain: 2,
  ancillarymanipulators: 3,
  ancillaryinterrogators: 3,
  foreignscminterface: 4,
  plumbingmanipulators: 5,
  plumbinginterrogators: 5,
  synchingrepositories: 4,
  synchelpers: 5,
  purehelpers: 5,
  alias: 1,
};

function invocationOf(name) {
  return name.startsWith("git-") ? `git ${name.slice(4)}` : name;
}

function difficultyOf(category, invocation) {
  if (category === "mainporcelain" && invocation.length <= SHORT_MAIN_COMMAND_MAX_LENGTH) return 1;
  return CATEGORY_DIFFICULTY[category];
}

function parseSource(source) {
  const commandList = source.split(COMMAND_LIST_MARKER)[1];
  if (!commandList) throw new Error("Git command-list marker is missing");
  const commands = [];
  for (const line of commandList.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [name, ...attributes] = trimmed.split(/\s+/);
    if (!/^(?:git-[a-z0-9-]+|gitk|gitweb|scalar)$/.test(name)) continue;
    const officialCategory = SOURCE_CATEGORIES.find((category) => attributes.includes(category));
    // Git declares `git-stage` only as a completion target. It is the official
    // alias for `git add`, so retain the invocable command in an explicit category.
    const category = officialCategory ?? (name === "git-stage" && attributes.includes("complete") ? "alias" : null);
    if (!category) throw new Error(`No command category for ${name}`);
    commands.push({ name, category });
  }

  if (commands.length !== EXPECTED_COMMAND_COUNT) {
    throw new Error(`Expected ${EXPECTED_COMMAND_COUNT} commands, received ${commands.length}`);
  }
  if (new Set(commands.map(({ name }) => name)).size !== commands.length) throw new Error("Duplicate Git command name");
  return commands;
}

function buildCatalogue(source, commands) {
  const sourceFileSha256 = createHash("sha256").update(source).digest("hex");
  if (sourceFileSha256 !== EXPECTED_SOURCE_FILE_SHA256) throw new Error("Official Git source snapshot changed");
  const canonicalCommands = `${commands.map(({ name, category }) => `${name}\t${category}`).join("\n")}\n`;
  const categoryCounts = Object.fromEntries(
    OUTPUT_CATEGORIES.map((category) => [category, commands.filter((row) => row.category === category).length]),
  );
  return {
    source: {
      product: "Git",
      version: SOURCE_VERSION,
      url: SOURCE_URL,
      retrievedOn: RETRIEVED_ON,
      fileSha256: sourceFileSha256,
      catalogueSha256: createHash("sha256").update(canonicalCommands).digest("hex"),
      scope: "Invocable command entries; documentation interfaces excluded; git-stage classified as an alias.",
    },
    stats: { commandCount: commands.length, categoryCounts },
    entries: commands.map(({ name, category }) => {
      const command = invocationOf(name);
      return {
        id: `git-command-${name.replace(/^git-/, "")}`,
        name,
        command,
        category,
        difficulty: difficultyOf(category, command),
      };
    }),
  };
}

const source = await readFile(sourcePath, "utf8");
const catalogue = buildCatalogue(source, parseSource(source));
const serializedCatalogue = `${JSON.stringify(catalogue, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const committedCatalogue = await readFile(outputPath, "utf8");
  if (committedCatalogue !== serializedCatalogue) {
    throw new Error("git-commands.json is not reproducible; run npm run import:git");
  }
  console.log(`Verified ${catalogue.stats.commandCount} generated Git commands.`);
} else {
  await writeFile(outputPath, serializedCatalogue, "utf8");
  console.log(`Generated ${catalogue.stats.commandCount} Git commands from Git ${SOURCE_VERSION}.`);
}
