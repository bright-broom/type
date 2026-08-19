import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  APPEARANCE_COOKIE,
  appearanceDataAttributes,
  parseAppearance,
} from "@/src/application/settings/appearance-cookie";
import "./globals.css";

export const metadata: Metadata = {
  title: "TypeLoop",
  description: "1日60秒。正確さとリズムを育てるタイピング練習。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the cookie here is what removes the theme flash: the attributes ship in
  // the initial HTML, so the first paint already uses the stored theme. No client
  // script can achieve this — React serialises one into its flight payload, which
  // runs after that paint (see ADR-014).
  const appearance = parseAppearance((await cookies()).get(APPEARANCE_COOKIE)?.value);
  return (
    <html lang="ja" {...appearanceDataAttributes(appearance)}>
      <body>{children}</body>
    </html>
  );
}
