import { TakkenGlossaryRoute } from "@/src/presentation/components/takken-assessment/TakkenGlossaryRoute";
import glossaryJson from "@/src/content/generated/takken-glossary.json";
import type { TakkenGlossary } from "@/src/content/takken/takken-glossary-types";

const glossary = glossaryJson as TakkenGlossary;

export default async function TakkenGlossaryPage({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string | string[] }>;
}) {
  const concept = (await searchParams).concept;
  const match = typeof concept === "string" ? concept.match(/^takken-term-(\d{3})$/) : null;
  const entry = match ? glossary.entries.find(({ id }) => id === Number(match[1])) : undefined;
  return <TakkenGlossaryRoute initialQuery={entry?.term} />;
}
