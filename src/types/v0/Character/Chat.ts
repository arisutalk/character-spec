import * as v from "valibot";
import { LorebookDataSchema } from "@/types/v0/Character/Lorebook";
import { MessageSchema } from "@/types/v0/Character/Message";
import { unique } from "@/types/v0/utils";

/**
 * @see {@link Chat}
 */
export const ChatSchema = v.object({
    /**
     * Unique identifier for the chat session.
     */
    id: v.string(),
    /**
     * The ID of the character associated with this chat.
     */
    characterId: v.string(),
    /**
     * The list of messages in this chat.
     */
    messages: v.pipe(v.array(MessageSchema), unique("id")),
    /**
     * Optional title for the chat.
     */
    title: v.optional(v.string(), "Chat"),
    /**
     * creation timestamp(unix epoch)
     */
    createdAt: v.optional(v.number(), Date.now),
    /**
     * Last updated timestamp(unix epoch)
     */
    updatedAt: v.optional(v.number(), Date.now),

    /**
     * Chat specific lorebook data.
     * @see {@link LorebookDataSchema}
     */
    lorebook: v.optional(LorebookDataSchema.entries.data),
});

/**
 * Represents a chat session with a character.
 */
export type Chat = v.InferOutput<typeof ChatSchema>;
