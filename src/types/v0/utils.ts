import * as v from "valibot";

/**
 * This type is used to represent the URL of an image.
 * It is used to validate the URL of an image.
 * If its protocol is `data:`, it means the image is base64 encoded.
 * This should only be used in exported character. When importing the character, it should be converted to `local:`.
 * If its protocol is `local:`, it means the image is stored in the browser, usually OpFS.
 * Otherwise, it should be a valid URL which can be fetched in browser.
 */
export const ImageURLSchema = v.pipe(v.string(), v.url());

/**
 * Valibot custom validator to ensure all objects in the array have unique values for a specific key.
 * Shortcut for `v.check(i=>new Set(i.map(j=>j[key])).size===i.length)`.
 * @param key The key to check for uniqueness. It should be a string key of the object.
 * @param errorMsg The error message to display if the validation fails.
 * @returns A valibot validator to be put on `v.pipe`.
 * @example
 * ```ts
 * const schema = v.array(v.object({ name: v.string() }), unique("name"));
 * ```
 */
export function unique<
    const ARR extends {
        [key: string]: unknown;
    },
>(key: keyof ARR, errorMsg?: string) {
    return v.check(
        (i: ARR[]) => {
            return new Set(i.map((j) => j[key])).size === i.length;
        },
        errorMsg ?? `Not unique key: ${String(key)}`,
    );
}

/**
 * Valibot custom schema to ensure the value is a positive integer.
 */
export const positiveInteger = v.pipe(
    v.pipe(v.number(), v.integer()),
    v.minValue(1),
);
