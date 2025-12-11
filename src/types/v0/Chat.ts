import * as v from "valibot";
import { MessageSchema } from "@/types/v0/Message";

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
    messages: v.array(MessageSchema),
    /**
     * Optional title for the chat.
     */
    title: v.optional(v.string()),
    /**
     * creation timestamp(unix epoch)
     */
    createdAt: v.optional(v.number(), Date.now),
    /**
     * Last updated timestamp(unix epoch)
     */
    updatedAt: v.optional(v.number(), Date.now),
});

/**
 * Represents a chat session with a character.
 */
export type Chat = v.InferOutput<typeof ChatSchema>;
