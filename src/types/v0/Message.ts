import * as v from "valibot";

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
         * URL of the file. May be absolute or relative, or even uuid.
         * Client should handle the actual file loading.
         * Don't use base64 encoded file. Instead, use with type:"inline_file".
         */
        data: v.string(),
        /**
         * MIME type of the file.
         */
        mimeType: v.string(),
    }),
    inline_file: v.object({
        /**
         * inline_file: The file content is embedded in the message.
         */
        type: v.literal("inline_file"),
        /**
         * File content. May be base64 encoded or file, or blob.
         * It's good to use url with type:"file" instead, to avoid getting too large message.
         */
        data: v.union([v.file(), v.pipe(v.string(), v.base64()), v.blob()]),
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
        MessageContentSchema.inline_file,
    ]),
    /** The timestamp when the message was created. */
    timestamp: v.optional(v.number()),
});

/**
 * Represents a single message in a chat history.
 */
export type Message = v.InferOutput<typeof MessageSchema>;
