export type AisConfidence = "確定" | "一部要確認" | "要確認";

export type AisReviewPriority = "" | "高" | "中" | "低";

export type AisGlossaryEntry = {
  id: number;
  termId: string;
  term: string;
  reading: string;
  englishName: string;
  definition: string;
  meetingContext: string;
  termKind: string;
  confidence: AisConfidence;
  reviewState: string;
  categories: ReadonlyArray<string>;
  categoryLabel: string;
  reviewPriority: AisReviewPriority;
  reviewQuestion: string;
  /** True when the source named a real customer or individual and the importer replaced it. */
  masked: boolean;
};

export type AisMeeting = {
  id: string;
  name: string;
  date: string;
  organization: string;
  sourceType: string;
};

export type AisGlossary = {
  title: string;
  meeting: AisMeeting;
  version: number;
  stats: {
    entryCount: number;
    maskedEntryCount: number;
    reviewQueueCount: number;
  };
  masking: {
    policy: string;
    redactionCounts: Readonly<Record<string, number>>;
  };
  filters: {
    categories: ReadonlyArray<string>;
    confidenceLevels: ReadonlyArray<AisConfidence>;
    termKinds: ReadonlyArray<string>;
  };
  entries: ReadonlyArray<AisGlossaryEntry>;
};
