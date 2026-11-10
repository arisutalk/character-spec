/**
 * Type compatibility test: the generated declarations (`dist`) must agree with
 * the types inferred from the schemas in `src`.
 *
 * This file is only type-checked, never executed. It compiles if, and only if,
 * every generated type is identical to the matching `z.infer<>` type.
 * Build first (`pnpm build`), then run `pnpm test:types`.
 */

import type * as z from "zod";

// What the code is: the schemas
import * as Src from "@/types/v0";

// What consumers see: the generated declarations of the public entry point
import type * as Dist from "../dist/v0";
import type { Equals, Expect } from "./type-test-utils";

type Inferify<T> = T extends z.ZodType ? z.infer<T> : T;

/**
 * Produces a value of the inferred type of `T`. Type-level only.
 * Pass a schema to infer its output type, or give a type argument.
 */
declare function it<T>(schema?: T): Inferify<T>;

/**
 * Check exact type equality. Doesn't compile if `A` and `B` are not equal.
 * Pass a schema to compare its output type.
 * @param __proof Doesn't compile if A and B are not equal. No need to pass this parameter.
 */
declare function is<A, B>(
    a: A,
    b: B,
    ...__proof: Equals<Inferify<A>, Inferify<B>> extends true ? [] : [never]
): true;

// =============================================================================
// Generated plain types vs. inferred types
// =============================================================================

function testAssetsTypes() {
    is(Src.AssetEntitySchema, it<Dist.AssetEntity>());
    is(Src.AssetsSettingSchema, it<Dist.AssetsSetting>());
}

function testCharacterTypes() {
    is(Src.CharacterSchema, it<Dist.Character>());
    is(Src.CharacterPromptDataSchema, it<Dist.CharacterPromptData>());
}

function testChatTypes() {
    is(Src.ChatSchema, it<Dist.Chat>());
}

function testLorebookTypes() {
    is(Src.LorebookConditionSchema, it<Dist.LorebookCondition>());
    is(Src.LorebookEntrySchema, it<Dist.LorebookEntry>());
    is(Src.LorebookDataSchema, it<Dist.LorebookData>());
}

function testMessageTypes() {
    is(Src.MessageSchema, it<Dist.Message>());
    is(Src.RoleSchema, it<Dist.Role>());
}

function testMetaTypes() {
    is(Src.MetaSchema, it<Dist.Meta>());
}

function testInstructionTypes() {
    is(Src.InstructionSchema, it<Dist.Instruction>());
}

function testExecutablesTypes() {
    is(Src.ScriptSettingSchema, it<Dist.ScriptSetting>());
    is(Src.ReplaceHookSchema, it<Dist.ReplaceHook>());
    is(Src.ReplaceHookEntitySchema, it<Dist.ReplaceHookEntity>());
    is(Src.ReplaceHookMetaSchema, it<Dist.ReplaceHookMeta>());
}

function testUtilsTypes() {
    is(Src.FileSchema, it<Dist.FileType>());
    is(Src.ImageURLSchema, it<Dist.ImageURL>());
    is(Src.Uint8ArraySchema, it<Dist.Uint8ArrayType>());
}

// Keep the tests above "used"
export const typeTests = [
    testAssetsTypes,
    testCharacterTypes,
    testChatTypes,
    testLorebookTypes,
    testMessageTypes,
    testMetaTypes,
    testInstructionTypes,
    testExecutablesTypes,
    testUtilsTypes,
];

// =============================================================================
// Generated schema declarations vs. the schemas
// =============================================================================

/** Names of every schema of the public entry point. */
type SchemaName = Extract<keyof typeof Src, `${string}Schema`>;

/** The output type of every schema, by name. */
type InferredSchemas<Module extends Record<SchemaName, z.ZodType>> = {
    [K in SchemaName]: z.infer<Module[K]>;
};

/** The runtime and the declarations expose the same names. */
export type SameExports = Expect<Equals<keyof typeof Src, keyof typeof Dist>>;

/** Every generated schema declaration infers to the same type as its source. */
export type SameSchemas = Expect<
    Equals<InferredSchemas<typeof Dist>, InferredSchemas<typeof Src>>
>;

// =============================================================================
// Schemas stay transparent (not an opaque `ZodType<T>`)
// =============================================================================

/** `.shape` only exists on `ZodObject`, so this fails if the schema is opaque. */
export type CharacterShape = typeof Dist.CharacterSchema.shape;
