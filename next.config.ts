import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
export function resolveReleaseCommit(vercelSha: string | undefined, githubSha: string | undefined) {
  const candidate = vercelSha ?? githubSha ?? "";
  return /^[0-9a-f]{40}$/.test(candidate) ? candidate : "unavailable";
}
export const RELEASE_COMMIT = resolveReleaseCommit(process.env.VERCEL_GIT_COMMIT_SHA, process.env.GITHUB_SHA);
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'" + (isDevelopment ? " 'unsafe-eval'" : ""),
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

export const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
] as const;

export const RELEASE_HEADER = { key: "X-TypeLoop-Release", value: RELEASE_COMMIT } as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS, RELEASE_HEADER] },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
