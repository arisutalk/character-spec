import { z } from "zod";
import { AssetsSettingSchema } from "@/types/v0/Character/Assets";
import { LorebookDataSchema } from "@/types/v0/Character/Lorebook";
import { MetaSchema } from "@/types/v0/Character/Meta";
import { ScriptSettingSchema as ExecutableSettingSchema } from "@/types/v0/Executables/Executable";

/**
 * The prompt data for a character.
 * It is used to generate the character's persona.
 * All of parameters are for AI prompt, and scriptable.
 */
export type CharacterPromptData = z.infer<typeof CharacterPromptDataSchema>;

export const CharacterPromptDataSchema = z
    .object({
        description: z
            .string()
            .meta({ description: "The character description." }),
        authorsNote: z.string().optional().meta({
            description:
                "The authors note. It's usually used to mock the user's message (differ by prompt).",
        }),
        lorebook: LorebookDataSchema.meta({
            description: "Global lorebook data",
        }),
    })
    .meta({
        description:
            "The prompt data for a character. Used to generate the character's persona. All parameters are for AI prompt and scriptable.",
    });

export const CharacterSchema = z
    .object({
        specVersion: z.literal(0).meta({
            description:
                "The version of the character spec. Used to determine which schema to use for parsing and migration.",
        }),
        id: z
            .string()
            .meta({ description: "Unique identifier for the character." }),
        name: z.string().meta({
            description:
                "The display name of the character. Human readable, not scriptable.",
        }),
        description: z.string().meta({
            description:
                "A short description of the character. Human readable, not scriptable.",
        }),
        avatarUrl: z.string().optional().meta({
            description:
                "Optional name of asset for the character's avatar image.",
        }),
        prompt: CharacterPromptDataSchema.meta({
            description: "The prompt data for the character.",
        }),
        executables: ExecutableSettingSchema.meta({
            description:
                "Script and hooks which can be used to control the character's behavior.",
        }),
        metadata: MetaSchema.meta({
            description:
                "Additional metadata about the character. Not used by the system, but can be used by the user.",
        }),
        assets: AssetsSettingSchema.meta({
            description: "Assets for the character.",
        }),
    })
    .meta({ description: "Represents a specific AI character personality." });

/**
 * Represents a specific AI character personality.
 */
export type Character = z.infer<typeof CharacterSchema>;
