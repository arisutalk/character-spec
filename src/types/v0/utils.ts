import { z } from "zod";

/**
 * This type is used to represent the URL of an image.
 * It is used to validate the URL of an image.
 * If its protocol is `data:`, it means the image is base64 encoded.
 * This should only be used in exported character. When importing the character, it should be converted to `local:`.
 * If its protocol is `local:`, it means the image is stored in the browser, usually OpFS.
 * Otherwise, it should be a valid URL which can be fetched in browser.
 */
export const ImageURLSchema = z.url().meta({
    description:
        "URL of an image. `data:` for base64 (export only), `local:` for browser storage (OpFS), otherwise a fetchable URL.",
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
    .number()
    .int()
    .min(1)
    .meta({ description: "Positive integer (>= 1)" });
