import { z } from "zod";
import { AssetEntitySchema } from "@/types/v0/Character/Assets";
import { FileSchema, unique } from "@/types/v0/utils";

/**
 * Represents the role of the message sender.
 */
export const RoleSchema = z
    .enum(["user", "assistant", "system"])
    .meta({ description: "Represents the role of the message sender." });

const MessageContentSchema = {
    text: z
        .object({
            type: z.literal("text").meta({
                description: "The message content is a simple string.",
            }),
            data: z.string().meta({ description: "The message content." }),
        })
        .meta({ description: "Text message content." }),
    file: z
        .object({
            type: z.literal("file").meta({
                description:
                    "The file content is stored in the separated storage.",
            }),
            data: FileSchema.meta({ description: "The file content." }),
            mimeType: z
                .string()
                .meta({ description: "MIME type of the file." }),
        })
        .meta({ description: "File message content." }),
};

/**
 * @see {@link Message}
 */
export const MessageSchema = z
    .object({
        id: z
            .string()
            .meta({ description: "Unique identifier for the message." }),
        chatId: z.string().meta({
            description: "The ID of the chat associated with this message.",
        }),
        role: RoleSchema.meta({
            description: "The role of the message sender.",
        }),
        content: z
            .discriminatedUnion("type", [
                MessageContentSchema.text,
                MessageContentSchema.file,
            ])
            .meta({ description: "The content of the message." }),
        timestamp: z.number().default(Date.now).meta({
            description: "The timestamp when the message was created.",
        }),
        inlays: z
            .array(AssetEntitySchema)
            .refine(unique("name"), { message: "Not unique key: name" })
            .default([])
            .meta({
                description:
                    "The inlays of the message. It is not intended to be exported as public.",
            }),
    })
    .meta({ description: "Represents a single message in a chat history." });

/**
 * Represents a single message in a chat history.
 */
export type Message = z.infer<typeof MessageSchema>;
