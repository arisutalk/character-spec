import * as z from "zod";

export const MetaSchema = z.object({
    author: z.string().optional().meta({
        description: "The author of the character. Optional.",
    }),

    license: z
        .string()
        .default("ARR")
        .meta({
            description:
                "The license of the character. Optional. " +
                "Using SPDX license identifier or URL is recommended. " +
                "Default: ARR, which means the character is all rights reserved by the author.",
        }),
    version: z.string().optional().meta({
        description: "The version of the character. Optional.",
    }),

    distributedOn: z
        .string()
        .optional()
        .meta({
            description:
                "The distributed page of the character." +
                "URL is recommended. Optional.",
        }),
    additionalInfo: z
        .string()
        .optional()
        .meta({
            description:
                "Additional information about the character, " +
                "which can't be represented by other fields. Optional.",
        }),
});
