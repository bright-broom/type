import edition from "./takken-edition.json" with { type: "json" };

export const TAKKEN_EDITION = edition;
export const TAKKEN_EXAM_YEAR = Number.parseInt(edition.examDate.slice(0, 4), 10);
export const TAKKEN_PACK_SERIES = `${TAKKEN_EXAM_YEAR}.${edition.packRevision}`;

export function formatEditionDate(isoDate: string, style: "dots" | "japanese"): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) throw new Error(`Invalid edition date: ${isoDate}`);
  if (style === "dots") return `${year}.${month}.${day}`;
  return `${year}年${Number(month)}月${Number(day)}日`;
}
