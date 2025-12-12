import { z } from "zod";
import { LorebookDataSchema } from "@/types/v0/Character/Lorebook";
import { MessageSchema } from "@/types/v0/Character/Message";
import { unique } from "@/types/v0/utils";

/**
 * @see {@link Chat}
 */
export const ChatSchema = z
    .object({
        id: z
            .string()
            .meta({ description: "Unique identifier for the chat session." }),
        characterId: z
            .string()
            .meta({
                description:
                    "The ID of the character associated with this chat.",
            }),
        messages: z
            .array(MessageSchema)
            .refine(unique("id"), { message: "Not unique key: id" })
            .meta({ description: "The list of messages in this chat." }),
        title: z
            .string()
            .default("Chat")
            .meta({ description: "Optional title for the chat." }),
        createdAt: z
            .number()
            .default(Date.now)
            .meta({ description: "creation timestamp (unix epoch)" }),
        updatedAt: z
            .number()
            .default(Date.now)
            .meta({ description: "Last updated timestamp (unix epoch)" }),
        lorebook: LorebookDataSchema.shape.data
            .optional()
            .meta({ description: "Chat specific lorebook data." }),
    })
    .meta({ description: "Represents a chat session with a character." });

/**
 * Represents a chat session with a character.
 */
export type Chat = z.infer<typeof ChatSchema>;
