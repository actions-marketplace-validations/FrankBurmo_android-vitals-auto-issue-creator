import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "package-lock.json"],
  },
  ...tseslint.configs["flat/recommended"],
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      sourceType: "module",
      ecmaVersion: 2022,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
