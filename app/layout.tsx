import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import {
  APPEARANCE_COOKIE,
  appearanceDataAttributes,
  parseAppearance,
} from "@/src/application/settings/appearance-cookie";
import { ServiceWorkerRegistration } from "@/src/presentation/components/pwa/ServiceWorkerRegistration";
import browserThemeColors from "@/src/presentation/theme/browser-theme-colors.generated.json";
import "./globals.css";

export const metadata: Metadata = {
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

export async function generateViewport(): Promise<Viewport> {
  const appearance = parseAppearance((await cookies()).get(APPEARANCE_COOKIE)?.value);
  const dark = appearance.themeId === "noir";
  return {
    colorScheme: dark ? "dark" : "light",
    themeColor: dark ? browserThemeColors.dark : browserThemeColors.light,
  };
}

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
    <html lang="ja" suppressHydrationWarning {...appearanceDataAttributes(appearance)}>
      <head>
        <Script
          src="/theme-bootstrap.js"
          strategy="beforeInteractive"
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
