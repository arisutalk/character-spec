import { z } from "zod";

/**
 * This type is used to represent the URL of an image.
 * It is used to validate the URL of an image.
 * This should only be used in exported character. When importing the character, it should be converted to `local:`.
 * If its protocol is `local:`, it means the image is stored in the browser, usually OpFS.
 * Otherwise, it should be a valid URL which can be fetched in browser.
 * Don't use `data:` URL for large images, as it can bloat the character spec size.
 *
 */
export const ImageURLSchema = z.url().meta({
    description:
        "URL of an image. `local:` for browser storage (OpFS), otherwise a fetchable URL. While it can be `data:` URL for base64 encoded images, it's not recommended.",
});

/**
 * Binary data represented as Uint8Array.
 * Useful for local file assets.
 */
export const Uint8ArraySchema = z.instanceof(Uint8Array).meta({
    description: "The binary data of the file. Used for local assets.",
    tsType: "Uint8Array",
});

/**
 * Represents a file, either as a URL or as binary data (Uint8Array).
 * Used for file assets.
 */
export const FileSchema = z
    .union([
        // URL Asset
        ImageURLSchema,
        Uint8ArraySchema,
    ])
    .meta({
        description:
            "Represents a file, either as a URL or as binary data (Uint8Array).\n" +
            "@type {string | Uint8Array}\n",
    });
/**
 * Custom validator to ensure all objects in the array have unique values for a specific key.
 * @param key The key to check for uniqueness. It should be a string key of the object.
 * @returns A predicate function for `z.refine`.
 * @example
 * ```ts
 * const schema = z.array(z.object({ name: z.string() })).refine(unique("name"), { message: "Not unique" });
 * ```
 */
export function unique<
    const ARR extends {
        [key: string]: unknown;
    },
>(key: keyof ARR) {
    return (i: ARR[]) => {
        return new Set(i.map((j) => j[key])).size === i.length;
    };
}

/**
 * Zod custom schema to ensure the value is a positive integer.
 */
export const positiveInteger = z
    .int()
    .min(1)
    .meta({ description: "Positive integer (>= 1)" });
