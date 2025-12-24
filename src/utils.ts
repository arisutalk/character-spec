import type * as z from "zod";

/**
 * Applies the given Zod schema to the provided data and returns the parsed output.
 * @param schema The Zod schema to apply.
 * @param data The data to be validated and parsed. Don't need to pass optional fields.
 * @returns The parsed output of the schema.
 */
export function apply<T extends z.ZodType>(
    schema: T,
    data: z.input<T>,
): z.output<T> {
    return schema.parse(data);
}
