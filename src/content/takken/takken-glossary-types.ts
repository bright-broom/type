export type TakkenImportance = "A" | "B" | "C";

export type TakkenGlossaryEntry = {
  id: number;
  category: string;
  subcategory: string;
  term: string;
  reading: string;
  definition: string;
  examNote: string;
  law: string;
  importance: TakkenImportance;
  sourceId: string;
  searchKeywords: string;
};

export type TakkenGlossary = {
  title: string;
  edition: string;
  examDate: string;
  legalBasisDate: string;
  version: number;
  provenance: {
    sourceRegistryVersion: number;
    sourceRegistryDigest: string;
    sourceDigest: string;
    retrievedAt: string;
  };
  stats: { entryCount: number };
  filters: {
    categories: ReadonlyArray<string>;
    importanceLevels: ReadonlyArray<TakkenImportance>;
    sourceIds: ReadonlyArray<string>;
  };
  entries: ReadonlyArray<TakkenGlossaryEntry>;
};
