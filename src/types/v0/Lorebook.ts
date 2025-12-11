import * as v from "valibot";

/**
 * @see {@link LorebookEntry}
 */
export const LorebookEntrySchema = v.object({
    /**
     * Internally generated ID.
     */
    id: v.optional(v.string()),
    /**
     * Human readable name for the lorebook.
     */
    name: v.string(),
    /**
     * The condition for the lorebook to be activated.
     * If empty, it will not be activated.
     * Duplicated condition is no effect.
     * Use 'always' to activate without any condition. {@link LorebookConditionTypeMap#always}
     */
    condition: v.optional(v.array(v.custom<LorebookCondition>(() => true))),
    /**
     * The strategy for resolving multiple conditions.
     * "all" means all conditions must be met.
     * "any" means at least one condition must be met.
     */
    multipleConditionResolveStrategy: v.optional(v.picklist(["all", "any"])),
    /**
     * The lorebook content to be added on AI prompt.
     * Not for human reading, and it's scriptable.
     */
    content: v.string(),
    /**
     * The priority of the lorebook.
     * Higher priority means it will be activated first, remains when token limit is exceeded.
     * May be negative. Base is 0. Allows demical.
     */
    priority: v.optional(v.number()),
    /**
     * Whether the lorebook is enabled.
     */
    enabled: v.optional(v.boolean()),
});
/**
 * A lorebook is a collection of lorebooks.
 * Lorebook is a small part of prompts which is activated by session's text matching.
 */
export type LorebookEntry = v.InferOutput<typeof LorebookEntrySchema>;

/**
 * @see {@link LorebookConditionSchema}
 */
export const LorebookConditionDetailSchema = {
    regex: v.object({
        /**
         * The type of the condition.
         * This condition matches the regex pattern.
         */
        type: v.literal("regex_match"),
        /**
         * The regex pattern to match.
         * Note that this is scriptable.
         */
        regexPattern: v.string(),
        /**
         * The regex flags to use.
         * Note that this is not scriptable.
         */
        regexFlags: v.optional(v.string()),
    }),
    plainText: v.object({
        /**
         * The type of the condition.
         * This condition simply matches the text.
         */
        type: v.literal("plain_text_match"),
        /**
         * The text to match.
         * Note that this is scriptable.
         * No case sensitive.
         */
        text: v.string(),
    }),
    always: v.object({
        /**
         * The type of the condition.
         * This condition is always true.
         */
        type: v.literal("always"),
    }),
} as const;

/**
 * The condition for the lorebook to be activated.
 */
export const LorebookConditionSchema = v.variant("type", [
    LorebookConditionDetailSchema.regex,
    LorebookConditionDetailSchema.plainText,
    LorebookConditionDetailSchema.always,
]);

/**
 * The condition for the lorebook to be activated.
 * @see {@link LorebookConditionSchema}
 */
export type LorebookCondition = v.InferOutput<typeof LorebookConditionSchema>;

/**
 * @see {@link LorebookData}
 */
export const LorebookDataSchema = v.object({
    /**
     * The configuration for the lorebook.
     * It is not scriptable.
     */
    config: v.object({
        /**
         * The token limit for the lorebook.
         * When the token limit is exceeded, some low-priority lorebooks will be deactivated to keep the token usage within the limit.
         * Positive integer.
         */
        tokenLimit: v.pipe(v.number(), v.integer(), v.minValue(1)),
    }),
    /**
     * Contains the actual lorebooks.
     * Duplicated id is not allowed.
     */
    data: v.optional(
        v.pipe(
            v.array(LorebookEntrySchema),
            v.check(
                (data) =>
                    data.map((i) => i.id).length ===
                    new Set(data.map((i) => i.id)).size,
                "Duplicated id is not allowed.",
            ),
        ),
        [],
    ),
});
/**
 * Object containing all data for the lorebook.
 * It's meant to be stored in the database and many other places.
 */
export type LorebookData = v.InferOutput<typeof LorebookDataSchema>;
