import glossaryJson from "../generated/takken-glossary.json" with { type: "json" };
import type { AssessmentChoice, AssessmentQuestion } from "../../domain/assessment/assessment-types.ts";
import type { TakkenGlossary, TakkenGlossaryEntry } from "./takken-glossary-types.ts";

export const TAKKEN_LEGAL_BASIS_DATE = "2026-04-01";
export const TAKKEN_PACK_REVIEW_STATUS = "provisional" as const;
const TAKKEN_PACK_SERIES = "2026.1";
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const CATEGORY_BLUEPRINT = [
  { label: "権利関係", id: "rights", count: 14 },
  { label: "法令上の制限", id: "legal-restrictions", count: 8 },
  { label: "宅建業法", id: "brokerage-law", count: 20 },
  { label: "税・その他", id: "tax-and-others", count: 8 },
] as const;
const IMPORTANCE_ORDER = { A: 0, B: 1, C: 2 } as const;
const glossary = glossaryJson as TakkenGlossary;

function selectAcrossSubcategories(entries: ReadonlyArray<TakkenGlossaryEntry>, count: number): TakkenGlossaryEntry[] {
  if (count > entries.length) throw new Error(`Cannot select ${count} questions from ${entries.length} entries`);
  const grouped = new Map<string, TakkenGlossaryEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.subcategory) ?? [];
    group.push(entry);
    grouped.set(entry.subcategory, group);
  }
  const groups = [...grouped.values()].map((group) =>
    group.sort(
      (left, right) => IMPORTANCE_ORDER[left.importance] - IMPORTANCE_ORDER[right.importance] || left.id - right.id,
    ),
  );
  const selected: TakkenGlossaryEntry[] = [];
  for (let round = 0; selected.length < count; round += 1) {
    for (const group of groups) {
      const entry = group[round];
      if (entry) selected.push(entry);
      if (selected.length === count) break;
    }
  }
  return selected;
}

function distractorsFor(target: TakkenGlossaryEntry): TakkenGlossaryEntry[] {
  const sameCategory = glossary.entries.filter((entry) => entry.category === target.category && entry.id !== target.id);
  const diverse = sameCategory.filter((entry) => entry.subcategory !== target.subcategory && entry.law !== target.law);
  const candidates = diverse.length >= 3 ? diverse : sameCategory;
  const stride = Math.max(1, Math.floor(candidates.length / 3));
  return [0, 1, 2].map((offset) => candidates[(target.id * 7 + offset * stride) % candidates.length]);
}

function rotate<Entry>(values: readonly Entry[], places: number): Entry[] {
  const offset = places % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function makeQuestion(target: TakkenGlossaryEntry, categoryId: string): AssessmentQuestion {
  const variant = target.id % 3;
  const entries = rotate([target, ...distractorsFor(target)], target.id % 4);
  const id = `takken-2026-term-${String(target.id).padStart(3, "0")}-v${variant + 1}`;
  const choices = entries.map((entry, index) => ({
    id: `${id}-choice-${index + 1}`,
    text: variant === 0 ? entry.definition : variant === 1 ? entry.term : entry.examNote,
  })) as [AssessmentChoice, AssessmentChoice, AssessmentChoice, AssessmentChoice];
  const targetIndex = entries.findIndex((entry) => entry.id === target.id);
  const stem =
    variant === 0
      ? `「${target.term}」の説明として、最も適切なものはどれか。`
      : variant === 1
        ? `「${target.definition}」に該当する用語はどれか。`
        : `「${target.term}」について、試験上の注意として最も適切なものはどれか。`;
  return {
    id,
    revision: 1,
    stem,
    choices,
    correctChoiceId: choices[targetIndex].id,
    explanation: `${target.term}：${target.definition} 試験上の注意：${target.examNote}`,
    categoryId,
    categoryLabel: target.category,
    conceptIds: [`takken-term-${String(target.id).padStart(3, "0")}`],
    legalBasisDate: TAKKEN_LEGAL_BASIS_DATE,
    sourceKind: "original-derived",
    sourceLabel: `${glossary.edition} TypeLoopオリジナル問題（${target.law}）`,
    reviewStatus: TAKKEN_PACK_REVIEW_STATUS,
  };
}

export const TAKKEN_ASSESSMENT_QUESTIONS: ReadonlyArray<AssessmentQuestion> = CATEGORY_BLUEPRINT.flatMap((category) =>
  selectAcrossSubcategories(
    glossary.entries.filter((entry) => entry.category === category.label),
    category.count,
  ).map((entry) => makeQuestion(entry, category.id)),
);

function packFingerprint(questions: ReadonlyArray<AssessmentQuestion>): string {
  let hash = FNV_OFFSET_BASIS;
  for (const character of JSON.stringify(questions)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const TAKKEN_PACK_VERSION = `${TAKKEN_PACK_SERIES}-${packFingerprint(TAKKEN_ASSESSMENT_QUESTIONS)}`;

export const TAKKEN_ASSESSMENT_CATEGORIES = CATEGORY_BLUEPRINT.map(({ id, label }) => ({ id, label }));
