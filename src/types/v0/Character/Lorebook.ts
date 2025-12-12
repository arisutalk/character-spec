import { z } from "zod";
import { unique } from "@/types/v0/utils";

/**
 * @see {@link LorebookConditionSchema}
 */
export const LorebookConditionDetailSchema = {
    regex: z
        .object({
            type: z
                .literal("regex_match")
                .meta({
                    description: "This condition matches the regex pattern.",
                }),
            regexPattern: z
                .string()
                .meta({
                    description: "The regex pattern to match. Scriptable.",
                }),
            regexFlags: z
                .string()
                .optional()
                .meta({
                    description: "The regex flags to use. Not scriptable.",
                }),
        })
        .meta({ description: "Regex match condition." }),
    plainText: z
        .object({
            type: z
                .literal("plain_text_match")
                .meta({
                    description: "This condition simply matches the text.",
                }),
            text: z
                .string()
                .meta({
                    description:
                        "The text to match. Scriptable. Case insensitive.",
                }),
        })
        .meta({ description: "Plain text match condition." }),
    always: z
        .object({
            type: z
                .literal("always")
                .meta({ description: "This condition is always true." }),
        })
        .meta({ description: "Always active condition." }),
} as const;

/**
 * The condition for the lorebook to be activated.
 */
export const LorebookConditionSchema = z.discriminatedUnion("type", [
    LorebookConditionDetailSchema.regex,
    LorebookConditionDetailSchema.plainText,
    LorebookConditionDetailSchema.always,
]);

/**
 * The condition for the lorebook to be activated.
 * @see {@link LorebookConditionSchema}
 */
export type LorebookCondition = z.infer<typeof LorebookConditionSchema>;

/**
 * @see {@link LorebookEntry}
 */
export const LorebookEntrySchema = z
    .object({
        id: z.string().meta({ description: "Internally generated ID." }),
        name: z
            .string()
            .meta({ description: "Human readable name for the lorebook." }),
        condition: z.array(LorebookConditionSchema).default([]).meta({
            description:
                "The condition for the lorebook to be activated. If empty, it will not be activated. Use 'always' to activate without any condition.",
        }),
        multipleConditionResolveStrategy: z
            .enum(["all", "any"])
            .optional()
            .meta({
                description:
                    "The strategy for resolving multiple conditions. 'all' means all must be met, 'any' means at least one.",
            }),
        content: z
            .string()
            .meta({
                description:
                    "The lorebook content to be added on AI prompt. Not for human reading. Scriptable.",
            }),
        priority: z.number().optional().meta({
            description:
                "The priority of the lorebook. Higher priority means it will be activated first. May be negative or decimal. Base is 0.",
        }),
        enabled: z
            .boolean()
            .optional()
            .meta({ description: "Whether the lorebook is enabled." }),
    })
    .meta({
        description:
            "A lorebook entry. Small part of prompts activated by session's text matching.",
    });

/**
 * A lorebook is a collection of lorebooks.
 * Lorebook is a small part of prompts which is activated by session's text matching.
 */
export type LorebookEntry = z.infer<typeof LorebookEntrySchema>;

/**
 * @see {@link LorebookData}
 */
export const LorebookDataSchema = z
    .object({
        config: z
            .object({
                tokenLimit: z.number().int().min(1).meta({
                    description:
                        "The token limit for the lorebook. When exceeded, low-priority lorebooks will be deactivated. Positive integer.",
                }),
            })
            .meta({
                description:
                    "The configuration for the lorebook. Not scriptable.",
            }),
        data: z
            .array(LorebookEntrySchema)
            .refine(unique("id"), { message: "Not unique key: id" })
            .default([])
            .meta({
                description:
                    "Contains the actual lorebooks. Duplicated id is not allowed.",
            }),
    })
    .meta({
        description:
            "Object containing all data for the lorebook. Meant to be stored in the database.",
    });

/**
 * Object containing all data for the lorebook.
 * It's meant to be stored in the database and many other places.
 */
export type LorebookData = z.infer<typeof LorebookDataSchema>;
