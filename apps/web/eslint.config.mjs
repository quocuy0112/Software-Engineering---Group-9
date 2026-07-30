import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/app/api/**/route.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/client",
                "@/backend/database/**",
                "@/backend/repositories/**",
                "@/shared/generated/prisma/**",
              ],
              message:
                "Route Handlers must call services, not data access directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/frontend/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/client",
                "resend",
                "@/backend/**",
                "@/shared/generated/prisma/client",
              ],
              message:
                "Presentation code cannot import server providers or data access.",
            },
          ],
        },
      ],
    },
  },
]);
