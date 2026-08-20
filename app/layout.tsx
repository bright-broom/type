import type { Metadata, Viewport } from "next";
import { appearanceDataAttributes } from "@/src/application/settings/appearance-cookie";
import { DEFAULT_APPEARANCE } from "@/src/application/settings/app-settings";
import { ServiceWorkerRegistration } from "@/src/presentation/components/pwa/ServiceWorkerRegistration";
import browserThemeColors from "@/src/presentation/theme/browser-theme-colors.generated.json";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://type-tau.vercel.app"),
  title: "TypeLoop",
  description: "1日60秒。正確さとリズムを育てるタイピング練習。",
  applicationName: "TypeLoop",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "TypeLoop", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: browserThemeColors.dark,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning {...appearanceDataAttributes(DEFAULT_APPEARANCE)}>
      <head>
        {/* Parser blocking by design: this 1.1 KB same-origin file establishes
            appearance before CSS can paint the invariant static shell. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          src="/theme-bootstrap.js"
          data-dark-color={browserThemeColors.dark}
          data-light-color={browserThemeColors.light}
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
