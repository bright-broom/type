import type { Metadata } from "next";
import { TypingApp } from "@/src/presentation/components/TypingApp";

const title = "TypeLoop — 60秒タイピングトレーニング";
const description = "正確さとリズムを育てる、日本語ローマ字タイピング練習。登録不要で今すぐ始められます。";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ja_JP",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "TypeLoop — タイピングと学習のループ" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.jpg"] },
};

export default function Home() {
  return <TypingApp />;
}
