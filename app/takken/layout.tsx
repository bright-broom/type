import type { Metadata } from "next";
import { TakkenSiteShell } from "@/src/presentation/components/takken-assessment/TakkenSiteShell";
import "../styles/takken-assessment.css";

export const metadata: Metadata = {
  title: "宅建試験対策 — TypeLoop",
  description: "2026年度宅建試験に向けた10問演習、本番模試、用語タイピング。",
};

export default function TakkenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <TakkenSiteShell>{children}</TakkenSiteShell>;
}
