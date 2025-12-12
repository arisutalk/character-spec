import { z } from "zod";
import { ImageURLSchema } from "@/types/v0/utils";

/**
 * Represents the role of the message sender.
 */
export const RoleSchema = z
    .enum(["user", "assistant", "system"])
    .meta({ description: "Represents the role of the message sender." });

const MessageContentSchema = {
    text: z
        .object({
            type: z
                .literal("string")
                .meta({
                    description: "The message content is a simple string.",
                }),
            data: z.string().meta({ description: "The message content." }),
        })
        .meta({ description: "Text message content." }),
    file: z
        .object({
            type: z
                .literal("file")
                .meta({
                    description:
                        "The file content is stored in the separated storage.",
                }),
            data: ImageURLSchema.meta({ description: "URL of the file." }),
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
        role: RoleSchema.meta({
            description: "The role of the message sender.",
        }),
        content: z
            .discriminatedUnion("type", [
                MessageContentSchema.text,
                MessageContentSchema.file,
            ])
            .meta({ description: "The content of the message." }),
        timestamp: z
            .number()
            .optional()
            .meta({
                description: "The timestamp when the message was created.",
            }),
    })
    .meta({ description: "Represents a single message in a chat history." });

/**
 * Represents a single message in a chat history.
 */
export type Message = z.infer<typeof MessageSchema>;
