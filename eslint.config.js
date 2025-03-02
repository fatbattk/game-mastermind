import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  // Config for all TypeScript files
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["vite.config.ts"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: ".",
      },
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  },
  // Separate config for vite.config.ts without type checking
  {
    files: ["vite.config.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  }
);
