import * as z from "zod";

import { LorebookConditionSchema } from "@/types/v0/Character/Lorebook";
import { MetaSchema } from "@/types/v0/Character/Meta";

/**
 * The prompt data for an AI instruction.
 * It is used to guide the AI's behavior during a session.
 */
export const InstructionSchema = z
    .object({
        specVersion: z.number().default(0).meta({
            description: "The version of the instruction spec.",
        }),
        id: z.string().meta({
            description: "Unique identifier for the instruction (UUID).",
        }),
        name: z.string().meta({
            description: "The display name of the instruction. Human readable.",
        }),
        description: z.string().optional().meta({
            description:
                "A short description of the instruction. Human readable.",
        }),
        content: z.string().meta({
            description: "The instruction prompt body that guides AI behavior.",
        }),
        condition: z.array(LorebookConditionSchema).default([]).meta({
            description:
                "The conditions under which this instruction is activated.",
        }),
        priority: z.number().default(0).meta({
            description: "The priority used when assembling the prompt.",
        }),
        enabled: z.boolean().default(true).meta({
            description: "Whether this instruction is enabled.",
        }),
        metadata: MetaSchema.meta({
            description:
                "Additional metadata about the instruction. Not used by the system.",
        }),
    })
    .meta({
        description:
            "Represents a single AI instruction. Used to guide AI behavior during a session.",
    });

/**
 * Represents a single AI instruction. Used to guide AI behavior during a session.
 */
export type Instruction = z.infer<typeof InstructionSchema>;
