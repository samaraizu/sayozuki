import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 客室オーダー（Cloudflare Workers）は別アプリ
    "order/**",
    // 予約管理（Google Apps Script）も別アプリ
    "booking/**",
    // OpenNext / wrangler のビルド成果物
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
