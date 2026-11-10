import zod from "eslint-plugin-zod";
import { defineConfig } from "oxlint";
type Rule = NonNullable<Parameters<typeof defineConfig>[0]["rules"]>;
function assertRule(rule: unknown): asserts rule is Rule {
    if (!rule || typeof rule !== "object") {
        throw new Error("eslint-plugin-zod: unknown rules obj.");
    }
    for (const [k, v] of Object.entries(rule)) {
        if (!k.startsWith("zod/")) {
            throw new Error(`eslint-plugin-zod: unknown rule name: ${k}`);
        }
        if (typeof v !== "string") {
            throw new Error(`eslint-plugin-zod: rule ${k} is not a string`);
        }
        if (!["error", "warn", "off", "allow", "block"].includes(v)) {
            throw new Error(`eslint-plugin-zod: rule ${k} is disabled`);
        }
    }
}
assertRule(zod.configs.recommended.rules);
export default defineConfig({
    jsPlugins: ["eslint-plugin-zod"],
    rules: {
        // Every rule of the recommended set is enabled, but the ones below.
        ...zod.configs.recommended.rules,

        // OWNER DECISION PENDING: `zod/prefer-string-schema-with-trim` is off.
        // It wants `.trim()` on every `z.string()` of the spec (34 as of 0.0.18), which changes the data
        // the spec carries, whitespace is meaningful in a lot of it: message text,
        // prompts and lorebook content (indentation, line breaks), `text` of a
        // plain text condition, `input` and `output` of replace hooks (`" "` is a
        // valid output). The rule has no option to pick the strings.
        // Choices: trim only the identifiers and labels (`id`, `chatId`, `name`,
        // `mimeType`...) and keep the rest, a spec change that needs its own
        // changelog entry. Or keep the strings as they are, and drop this rule.
        "zod/prefer-string-schema-with-trim": "off",
    },
});
