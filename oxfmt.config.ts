import { defineConfig } from "oxfmt";

export default defineConfig({
    useTabs: false,
    tabWidth: 4,
    printWidth: 80,
    singleQuote: false,
    jsxSingleQuote: false,
    quoteProps: "as-needed",
    trailingComma: "all",
    semi: true,
    arrowParens: "always",
    bracketSameLine: false,
    bracketSpacing: true,
    sortImports: true,
    ignorePatterns: ["dist/**", "node_modules/**"],
});
