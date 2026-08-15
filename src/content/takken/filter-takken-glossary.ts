import type { TakkenGlossaryEntry } from "./takken-glossary-types.ts";

export type TakkenGlossaryFilters = {
  query?: string;
  category?: string;
  importance?: string;
  sourceId?: string;
};

export function filterTakkenGlossary(
  entries: ReadonlyArray<TakkenGlossaryEntry>,
  filters: TakkenGlossaryFilters,
): ReadonlyArray<TakkenGlossaryEntry> {
  const normalizedQuery = filters.query?.trim().toLocaleLowerCase("ja") ?? "";
  return entries.filter((entry) => {
    const searchable = [
      entry.term,
      entry.reading,
      entry.category,
      entry.subcategory,
      entry.definition,
      entry.examNote,
      entry.law,
      entry.searchKeywords,
    ]
      .join(" ")
      .toLocaleLowerCase("ja");
    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!filters.category || entry.category === filters.category) &&
      (!filters.importance || entry.importance === filters.importance) &&
      (!filters.sourceId || entry.sourceId === filters.sourceId)
    );
  });
}
