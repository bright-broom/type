import type { Metadata } from "next";
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
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
