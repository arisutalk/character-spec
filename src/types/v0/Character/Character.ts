import { z } from "zod";
import { LorebookDataSchema } from "@/types/v0/Character/Lorebook";
import { ScriptSettingSchema as ExecutableSettingSchema } from "@/types/v0/Executables/Executable";
import { ImageURLSchema } from "@/types/v0/utils";

/**
 * The prompt data for a character.
 * It is used to generate the character's persona.
 * All of parameters are for AI prompt, and scriptable.
 */
export type CharacterPromptData = z.infer<typeof CharacterPromptDataSchema>;

/**
 * @see {@link CharacterPromptData}
 */
export const CharacterPromptDataSchema = z
    .object({
        description: z
            .string()
            .meta({ description: "The character description." }),
        authorsNote: z.string().meta({
            description:
                "The authors note. It's usually used to mock the user's message (differ by prompt).",
        }),
        lorebook: LorebookDataSchema.meta({ description: "Lorebook data." }),
    })
    .meta({
        description:
            "The prompt data for a character. Used to generate the character's persona. All parameters are for AI prompt and scriptable.",
    });

/**
 * @see {@link Character}
 */
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
        avatarUrl: ImageURLSchema.optional().meta({
            description: "Optional URL for the character's avatar image.",
        }),
        prompt: CharacterPromptDataSchema.meta({
            description: "The prompt data for the character.",
        }),
        executables: z.array(ExecutableSettingSchema).meta({
            description:
                "Script and hooks which can be used to control the character's behavior.",
        }),
    })
    .meta({ description: "Represents a specific AI character personality." });

/**
 * Represents a specific AI character personality.
 */
export type Character = z.infer<typeof CharacterSchema>;
