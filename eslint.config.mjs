import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([".next/**", "dist/**", "out/**", "build/**", "next-env.d.ts"]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      // WCAG 2.1.1 requires a scrollable region to be keyboard operable, which axe
      // enforces as `scrollable-region-focusable`. That needs a tabindex on a
      // container the plugin considers non-interactive, so the roles used for those
      // regions are allowed here rather than silenced at each call site.
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { tags: [], roles: ["tabpanel", "group", "region"], allowExpressionValues: true },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "TypeLoop runtime is local-first; add an ADR before network access." },
        { name: "XMLHttpRequest", message: "TypeLoop runtime is local-first; add an ADR before network access." },
        { name: "WebSocket", message: "TypeLoop runtime is local-first; add an ADR before network access." },
        { name: "EventSource", message: "TypeLoop runtime is local-first; add an ADR before network access." },
        { name: "eval", message: "Dynamic code execution is forbidden." },
        { name: "Function", message: "Dynamic code execution is forbidden." },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "axios",
            "got",
            "ky",
            "node-fetch",
            "undici",
            "http",
            "https",
            "http2",
            "net",
            "tls",
            "dgram",
            "dns",
            "node:http",
            "node:https",
            "node:http2",
            "node:net",
            "node:tls",
            "node:dgram",
            "node:dns",
            "node:dns/promises",
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='navigator'][property.name='sendBeacon'], MemberExpression[object.name='navigator'][property.value='sendBeacon']",
          message: "TypeLoop runtime is local-first; add an ADR before network access.",
        },
        {
          selector:
            "MemberExpression[object.name=/^(window|globalThis)$/][property.name='fetch'], MemberExpression[object.name=/^(window|globalThis)$/][property.value='fetch']",
          message: "TypeLoop runtime is local-first; add an ADR before network access.",
        },
        {
          selector: "MemberExpression[object.name=/^(window|globalThis)$/][computed=true]",
          message: "Computed global access can bypass the local-first network guardrail.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Raw HTML injection is forbidden.",
        },
      ],
    },
  },
]);

export default eslintConfig;
