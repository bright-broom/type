import commandCatalogueJson from "../generated/git-commands.json" with { type: "json" };
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import type { GitCommandCatalogue, GitCommandCategory } from "./git-command-types.ts";

const CATEGORY_LABELS: Record<GitCommandCategory, string> = {
  mainporcelain: "一般向けコマンド",
  ancillarymanipulators: "補助操作コマンド",
  ancillaryinterrogators: "補助参照コマンド",
  foreignscminterface: "他のバージョン管理システムとの連携",
  plumbingmanipulators: "低レベル操作コマンド",
  plumbinginterrogators: "低レベル参照コマンド",
  synchingrepositories: "リポジトリ同期コマンド",
  synchelpers: "同期用内部コマンド",
  purehelpers: "内部ヘルパー",
  alias: "公式エイリアス",
};

export const GIT_COMMAND_CATALOGUE = commandCatalogueJson as GitCommandCatalogue;

export const GIT_COMMAND_PROMPTS: ReadonlyArray<TypingPrompt> = GIT_COMMAND_CATALOGUE.entries.map((entry) => ({
  id: entry.id,
  displayText: entry.command,
  reading: entry.command,
  category: "git",
  difficulty: entry.difficulty,
  tags: [entry.category, `git-${GIT_COMMAND_CATALOGUE.source.version}`],
  description: CATEGORY_LABELS[entry.category],
}));
