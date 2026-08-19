import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { APPEARANCE_COOKIE, parseAppearance } from "@/src/application/settings/appearance-cookie";
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

export default async function Home({ searchParams }: { searchParams: Promise<{ training?: string | string[] }> }) {
  // The same cookie the layout used for the root attributes, so the client tree starts
  // from the value already painted instead of discovering it after hydration.
  const appearance = parseAppearance((await cookies()).get(APPEARANCE_COOKIE)?.value);
  const training = (await searchParams).training;
  return (
    <TypingApp initialAppearance={appearance} initialTrainingSet={training === "takken" ? "takken" : "japanese"} />
  );
}
