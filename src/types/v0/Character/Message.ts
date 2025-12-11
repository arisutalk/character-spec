import * as v from "valibot";
import { ImageURLSchema } from "@/types/v0/utils";

/**
 * Represents the role of the message sender.
 */
export const RoleSchema = v.union([
    v.literal("user"),
    v.literal("assistant"),
    v.literal("system"),
]);

const MessageContentSchema = {
    text: v.object({
        /**
         * string: The message content is a simple string.
         */
        type: v.literal("string"),
        /**
         * The message content.
         */
        data: v.string(),
    }),
    file: v.object({
        /**
         * file: The file content is stored in the separated storage.
         */
        type: v.literal("file"),
        /**
         * URL of the file.
         */
        data: ImageURLSchema,
        /**
         * MIME type of the file.
         */
        mimeType: v.string(),
    }),
};

/**
 * @see {@link Message}
 */
export const MessageSchema = v.object({
    /** Unique identifier for the message. */
    id: v.string(),
    /** The role of the message sender. */
    role: RoleSchema,
    /** The content of the message. */
    content: v.variant("type", [
        MessageContentSchema.text,
        MessageContentSchema.file,
    ]),
    /** The timestamp when the message was created. */
    timestamp: v.optional(v.number()),
});

/**
 * Represents a single message in a chat history.
 */
export type Message = v.InferOutput<typeof MessageSchema>;
