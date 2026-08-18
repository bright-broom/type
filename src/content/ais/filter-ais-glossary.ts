import type { AisGlossaryEntry } from "./ais-glossary-types.ts";

export type AisGlossaryFilters = {
  query?: string;
  category?: string;
  confidence?: string;
  termKind?: string;
  /** Keep only terms the meeting left unconfirmed, i.e. the review queue. */
  pendingReviewOnly?: boolean;
};

export function filterAisGlossary(
  entries: ReadonlyArray<AisGlossaryEntry>,
  filters: AisGlossaryFilters,
): ReadonlyArray<AisGlossaryEntry> {
  const normalizedQuery = filters.query?.trim().toLocaleLowerCase("ja") ?? "";
  return entries.filter((entry) => {
    const searchable = [
      entry.term,
      entry.reading,
      entry.englishName,
      entry.definition,
      entry.meetingContext,
      entry.termKind,
      entry.categoryLabel,
      ...entry.categories,
    ]
      .join(" ")
      .toLocaleLowerCase("ja");
    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!filters.category || entry.categories.includes(filters.category)) &&
      (!filters.confidence || entry.confidence === filters.confidence) &&
      (!filters.termKind || entry.termKind === filters.termKind) &&
      (!filters.pendingReviewOnly || entry.confidence !== "確定")
    );
  });
}
