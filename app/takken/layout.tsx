import type { Metadata } from "next";
import { TakkenSiteShell } from "@/src/presentation/components/takken-assessment/TakkenSiteShell";
import { TAKKEN_EXAM_YEAR } from "@/src/content/takken/takken-edition";

export const metadata: Metadata = {
  title: "宅建試験対策 — TypeLoop",
  description: `${TAKKEN_EXAM_YEAR}年度宅建試験に向けた10問演習、本番模試、用語タイピング。`,
};

export default function TakkenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <TakkenSiteShell>{children}</TakkenSiteShell>;
}
