import type { MetadataRoute } from "next";
import browserThemeColors from "@/src/presentation/theme/browser-theme-colors.generated.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TypeLoop — 60秒タイピングトレーニング",
    short_name: "TypeLoop",
    description: "正確さとリズムを育てる、日本語ローマ字タイピング練習。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: browserThemeColors.dark,
    theme_color: browserThemeColors.dark,
    lang: "ja",
    orientation: "any",
    categories: ["education", "productivity"],
    shortcuts: [
      {
        name: "宅建用語集",
        short_name: "宅建用語",
        description: "宅建試験の446用語を検索して確認します。",
        url: "/takken/glossary",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
