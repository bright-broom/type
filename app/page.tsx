import type { Metadata } from "next";
import { headers } from "next/headers";
import { TypingApp } from "@/src/presentation/components/TypingApp";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const title = "TypeLoop — 60秒タイピングトレーニング";
  const description = "正確さとリズムを育てる、日本語ローマ字タイピング練習。登録不要で今すぐ始められます。";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ja_JP",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function Home() {
  return <TypingApp />;
}
