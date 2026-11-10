import { defineConfig } from "oxlint";

import zod from "./scripts/linter/zod.ts";

export default defineConfig({
    plugins: ["typescript", "unicorn"],
    rules: {
        "no-unused-vars": ["warn"],
        "typescript/no-deprecated": "error",
    },
    env: {
        builtin: true,
    },
    ignorePatterns: [
        "dist/**",
        "node_modules/**",
        // Import `dist`, which only exists after a build: `lint:untyped` lints them.
        "tests/type-details.test.ts",
        "scripts/type-test.ts",
    ],
    options: {
        denyWarnings: true,
        maxWarnings: 0,
        typeAware: true,
        typeCheck: true,
        reportUnusedDisableDirectives: "error",
    },
    extends: [zod],
});
