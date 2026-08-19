import type { Metadata } from "next";
import Script from "next/script";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "@/src/presentation/theme/appearance-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "TypeLoop",
  description: "1日60秒。正確さとリズムを育てるタイピング練習。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
      <Script id="typeloop-appearance" strategy="beforeInteractive">
        {APPEARANCE_BOOTSTRAP_SCRIPT}
      </Script>
    </html>
  );
}
