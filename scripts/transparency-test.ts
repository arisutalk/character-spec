import type { CharacterSchema } from "../dist/v0/Character/Character";

// This test verifies if the exported schema is "transparent" (e.g., has .shape)
// In its current "opaque" state (ZodType<T>), this should fail to compile if we try to access .shape
// because ZodType doesn't have .shape. Only ZodObject has it.

// type CharacterShape = typeof CharacterSchema.shape;
type _CharacterShape = typeof CharacterSchema.shape;

// If it were transparent, we could do something like this:
// const idSchema = CharacterSchema.shape.id;
