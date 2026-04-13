import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist", "release", "node_modules", "test-results", "playwright-report"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Catches the React #300 class of bugs (conditional hook calls).
      "react-hooks/rules-of-hooks": "error",
      // Catches stale-closure bugs in useEffect/useCallback/useMemo deps.
      // Promoted to error once the existing backlog was cleared.
      "react-hooks/exhaustive-deps": "error",

      // Relax a few base rules that don't fit this codebase's style.
      // They're defensible to re-enable later in a separate pass.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
