import * as v from "valibot";
import { LorebookDataSchema } from "@/types/v0/Lorebook";

/**
 * The prompt data for a character.
 * It is used to generate the character's persona.
 * All of parameters are for AI prompt, and scriptable.
 */
export type CharacterPromptData = v.InferOutput<
    typeof CharacterPromptDataSchema
>;

/**
 * @see {@link CharacterPromptData}
 */
export const CharacterPromptDataSchema = v.object({
    /**
     * The character description.
     */
    description: v.string(),
    /**
     * The authors note. It's usually used to mock the user's message(differ by prompt).
     */
    authorsNote: v.string(),
    /**
     * Lorebook data.
     * @see {@link LorebookDataSchema}
     */
    lorebook: LorebookDataSchema,
});

/**
 * @see {@link Character}
 */
export const CharacterSchema = v.object({
    /**
     * The version of the character spec.
     * This is used to determine which schema to use for parsing.
     * Also tries to migrate the character to the latest version.
     */
    specVersion: v.literal(0),
    /**
     * Unique identifier for the character.
     */
    id: v.string(),
    /**
     * The display name of the character.
     * Human readable, not scriptable.
     */
    name: v.string(),
    /**
     * A short description of the character.
     * Human readable, not scriptable.
     */
    description: v.string(),
    /**
     * Optional URL for the character's avatar image.
     */
    avatarUrl: v.optional(v.pipe(v.string(), v.url())),
    prompt: CharacterPromptDataSchema,
});

/**
 * Represents a specific AI character personality.
 */
export type Character = v.InferOutput<typeof CharacterSchema>;
