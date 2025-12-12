import { z } from "zod";

const ReplaceHookMetaType = [
    z
        .object({
            type: z
                .literal("regex")
                .meta({ description: "The input pattern is a RegExp." }),
            flag: z.string().meta({ description: "The flag for RegExp." }),
        })
        .meta({ description: "Regex pattern type." }),
    z
        .object({
            type: z
                .literal("string")
                .meta({ description: "The input pattern is a simple string." }),
            caseSensitive: z.boolean().default(true).meta({
                description: "If true, the input pattern is case sensitive.",
            }),
        })
        .meta({ description: "String pattern type." }),
] as const;

export const ReplaceHookMetaSchema = z.intersection(
    z.discriminatedUnion("type", ReplaceHookMetaType),
    z.object({
        isInputPatternScripted: z.boolean().default(false).meta({
            description:
                "If true, input pattern might contain additional javascript expression. Resolved before matching.",
        }),
        isOutputScripted: z.boolean().default(false).meta({
            description:
                "If true, output might contain additional javascript expression. Resolved after matching.",
        }),
        priority: z.number().default(0).meta({
            description:
                "The priority of the replace hook. Higher number means higher priority. Can be positive, negative, or fractional.",
        }),
    }),
);

export const ReplaceHookEntitySchema = z.object({
    input: z.string().meta({
        description:
            "The input pattern. May contain additional javascript expression if `isInputPatternScripted` is true.",
    }),
    meta: ReplaceHookMetaSchema.meta({
        description: "The meta data for the replace hook.",
    }),
    output: z.string().meta({
        description:
            "The output. May contain additional javascript expression if `isOutputScripted` is true.",
    }),
});

/**
 * Replace hooks. It's technically RegExp for request, display, and response.
 */
export const ReplaceHookSchema = z
    .object({
        display: z.array(ReplaceHookEntitySchema).meta({
            description:
                "Replace hooks for display. Doesn't edit the data, only changes the display.",
        }),
        input: z.array(ReplaceHookEntitySchema).meta({
            description:
                "Replace hooks for input. User chat input will be edited by this.",
        }),
        output: z.array(ReplaceHookEntitySchema).meta({
            description:
                "Replace hooks for output. Character response will be edited by this.",
        }),
        request: z.array(ReplaceHookEntitySchema).meta({
            description:
                "Replace hooks for request. AI request will be edited by this. Differs from `input` in that it's for AI request. Does not edit the data, only changes the fetching request.",
        }),
    })
    .meta({
        description:
            "Replace hooks. RegExp for request, display, and response.",
    });
