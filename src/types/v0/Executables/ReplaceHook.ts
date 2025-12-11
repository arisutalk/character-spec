import * as v from "valibot";

const ReplaceHookMetaType = [
    v.object({
        /**
         * If "regex", it means the input pattern is a RegExp.
         */
        type: v.literal("regex"),
        /**
         * The flag for RegExp.
         */
        flag: v.string(),
    }),
    v.object({
        /**
         * If "string", it means the input pattern is a simple string.
         */
        type: v.literal("string"),
        /**
         * If true, the input pattern is case sensitive.
         */
        caseSensitive: v.optional(v.boolean(), true),
    }),
];
export const ReplaceHookMetaSchema = v.intersect([
    v.variant("type", ReplaceHookMetaType),
    v.object({
        /**
         * If true, input pattern might contain additional javascript expression.
         * Should be resolved first before matching.
         */
        isInputPatternScripted: v.optional(v.boolean(), false),
        /**
         * If true, output might contain additional javascript expression.
         * Should be resolved after matching.
         */
        isOutputScripted: v.optional(v.boolean(), false),
        /**
         * The priority of the replace hook.
         * Higher number means higher priority.
         * Can be positive or negative, or even fractional.
         */
        priority: v.optional(v.number(), 0),
    }),
]);

export const ReplaceHookEntitySchema = v.object({
    /**
     * The input pattern. May contain additional javascript expression if `isInputPatternScripted` is true.
     * @see {@link ReplaceHookMetaSchema}
     */
    input: v.string(),
    /**
     * The meta data for the replace hook.
     * @see {@link ReplaceHookMetaSchema}
     */
    meta: ReplaceHookMetaSchema,
    /**
     * The output. May contain additional javascript expression if `isOutputScripted` is true.
     * @see {@link ReplaceHookMetaSchema}
     */
    output: v.string(),
});
/**
 * Replace hooks. It's technically RegExp for request, display, and response.
 */

export const ReplaceHookSchema = v.object({
    /**
     * Replace hooks for display. Doesn't edit the data, only changes the display.
     */
    display: v.array(ReplaceHookEntitySchema),
    /**
     * Replace hooks for input. User chat input will be edited by this.
     */
    input: v.array(ReplaceHookEntitySchema),
    /**
     * Replace hooks for output. Character response will be edited by this.
     */
    output: v.array(ReplaceHookEntitySchema),
    /**
     * Replace hooks for request. AI request will be edited by this.
     * Differs from `input` in that it's for AI request.
     * It does not edit the data, only changes the fetching request.
     */
    request: v.array(ReplaceHookEntitySchema),
});
