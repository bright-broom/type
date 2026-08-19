export type GitCommandCategory =
  | "mainporcelain"
  | "ancillarymanipulators"
  | "ancillaryinterrogators"
  | "foreignscminterface"
  | "plumbingmanipulators"
  | "plumbinginterrogators"
  | "synchingrepositories"
  | "synchelpers"
  | "purehelpers"
  | "alias";

export type GitCommandCatalogue = {
  source: {
    product: "Git";
    version: string;
    url: string;
    retrievedOn: string;
    fileSha256: string;
    catalogueSha256: string;
    scope: string;
  };
  stats: {
    commandCount: number;
    categoryCounts: Record<GitCommandCategory, number>;
  };
  entries: ReadonlyArray<{
    id: string;
    name: string;
    command: string;
    category: GitCommandCategory;
    difficulty: number;
  }>;
};
