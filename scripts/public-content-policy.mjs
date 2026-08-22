const PUBLIC_RUNTIME_ROOTS = ["app/", "public/", "src/"];

const RESTRICTED_PATHS = [
  /^app\/ais(?:\/|$)/u,
  /^src\/content\/ais(?:\/|$)/u,
  /^src\/presentation\/components\/ais(?:\/|$)/u,
  /^src\/content\/generated\/ais-glossary\.json$/u,
];

const RESTRICTED_MARKERS = [
  { code: "meeting-dataset-label", pattern: /AIS週次定例会議/u },
  { code: "meeting-record-id", pattern: /MTG-[0-9-]+-AIS\b/u },
  { code: "stable-party-pseudonym", pattern: /(?:顧客|担当者)[A-Z](?![A-Za-z])/u },
  { code: "masked-meeting-field", pattern: /実名非開示/u },
];

const EMAIL_CANDIDATE = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu;
const DOCUMENTATION_DOMAINS = new Set(["example.com", "example.org", "example.net"]);

function containsPersonalEmail(text) {
  for (const match of text.matchAll(EMAIL_CANDIDATE)) {
    if (!DOCUMENTATION_DOMAINS.has(match[1].toLowerCase())) return true;
  }
  return false;
}

export function isPublicRuntimePath(path) {
  return (
    PUBLIC_RUNTIME_ROOTS.some((root) => path.startsWith(root)) &&
    !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path) &&
    !path.endsWith("/AGENTS.md")
  );
}

export function restrictedTextViolations(text) {
  return RESTRICTED_MARKERS.filter(({ pattern }) => pattern.test(text)).map(({ code }) => code);
}

export function publicContentViolations(path, text) {
  if (!isPublicRuntimePath(path)) return [];
  const violations = RESTRICTED_PATHS.filter((pattern) => pattern.test(path)).map(() => "restricted-runtime-path");
  violations.push(...restrictedTextViolations(text));
  if (containsPersonalEmail(text)) violations.push("personal-email");
  return [...new Set(violations)];
}
