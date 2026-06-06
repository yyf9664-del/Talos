import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "next-env.d.ts",
      "out/**",
      "public/pdf.worker.min.mjs",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "prefer-const": "warn",
    },
  },
  {
    // Icon-only buttons must expose an accessible name (aria-label / title /
    // sr-only text). Guards against the regression audited in P4.
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/control-has-associated-label": [
        "warn",
        {
          labelAttributes: ["aria-label", "title"],
          controlComponents: ["Button"],
          depth: 3,
        },
      ],
    },
  },
];

export default eslintConfig;
