import { defineConfig } from "oxlint";

import base from "./oxlint.config.ts";

/**
 * The same rules as `oxlint.config.ts`, without the type information, for the
 * files which `oxlint.config.ts` ignores: they import `dist`, which only exists
 * after a build, so oxlint cannot type-check them on a fresh clone (`pnpm lint`
 * and the pre-commit hook would fail). `tsc -p tsconfig.dist.json` type-checks
 * them, as part of `pnpm test:types`.
 */
export default defineConfig({
    ...base,
    options: { ...base.options, typeAware: false, typeCheck: false },
    ignorePatterns: ["dist/**", "node_modules/**"],
});
