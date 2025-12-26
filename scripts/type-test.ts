/**
 * Type compatibility test: Verify generated types are compatible with z.infer<> types
 * This file should compile without errors if types are compatible.
 *
 * Uses `satisfies` operator to verify type compatibility at compile time.
 * If a type doesn't satisfy the constraint, TypeScript will show a compile error.
 *
 * Run: pnpm tsc -p tsconfig.typetest.json
 */

import type * as z from "zod";
// Import generated types from dist
import type { AssetEntity, AssetsSetting } from "../dist/v0/Character/Assets";
import type {
    Character,
    CharacterPromptData,
} from "../dist/v0/Character/Character";
import type { Chat } from "../dist/v0/Character/Chat";
import type {
    LorebookCondition,
    LorebookData,
    LorebookEntry,
} from "../dist/v0/Character/Lorebook";
import type { Message, Role } from "../dist/v0/Character/Message";
import type { Meta } from "../dist/v0/Character/Meta";
import type { ScriptSetting } from "../dist/v0/Executables/Executable";
import type {
    ReplaceHook,
    ReplaceHookEntity,
    ReplaceHookMeta,
} from "../dist/v0/Executables/ReplaceHook";
import type { FileType, ImageURL, Uint8ArrayType } from "../dist/v0/utils";
// Import Zod schemas from source
import {
    AssetEntitySchema,
    AssetsSettingSchema,
} from "../src/types/v0/Character/Assets";
import {
    CharacterPromptDataSchema,
    CharacterSchema,
} from "../src/types/v0/Character/Character";
import { ChatSchema } from "../src/types/v0/Character/Chat";
import {
    LorebookConditionSchema,
    LorebookDataSchema,
    LorebookEntrySchema,
} from "../src/types/v0/Character/Lorebook";
import { MessageSchema, RoleSchema } from "../src/types/v0/Character/Message";
import { MetaSchema } from "../src/types/v0/Character/Meta";
import { ScriptSettingSchema } from "../src/types/v0/Executables/Executable";
import {
    ReplaceHookEntitySchema,
    ReplaceHookMetaSchema,
    ReplaceHookSchema,
} from "../src/types/v0/Executables/ReplaceHook";
import {
    FileSchema,
    ImageURLSchema,
    Uint8ArraySchema,
} from "../src/types/v0/utils";
import type { Equals } from "./type-test-utils";

type Inferify<T> = T extends z.ZodType ? z.infer<T> : T;
function it<T>(_?: T): Inferify<T> {
    //@ts-expect-error
    return {};
}
/**
 * Check exact type equality, bidirectional.
 * If you need omnidirectional type equality, use `satisfies`.
 * @param _a Pass value to compare
 * @param _b Pass value to compare
 * @param __proof Doesn't compile if A and B are not equal. No need to pass this parameter.
 */
function is<A, B>(
    _a: A,
    _b: B,
    ...__proof: Equals<Inferify<A>, Inferify<B>> extends true ? [] : [never]
): true {
    return true;
}

// =============================================================================
// Type Compatibility Tests using `satisfies`
// =============================================================================

/**
 * Test Character/Assets types
 */
function testAssetsTypes() {
    // AssetEntity - bidirectional
    is(AssetEntitySchema, it<AssetEntity>());

    // AssetsSetting - bidirectional
    is(AssetsSettingSchema, it<AssetsSetting>());
}

/**
 * Test Character/Character types
 */
function testCharacterTypes() {
    // Character - bidirectional
    is(CharacterSchema, it<Character>());

    // CharacterPromptData - bidirectional
    is(CharacterPromptDataSchema, it<CharacterPromptData>());
}

/**
 * Test Character/Chat types
 */
function testChatTypes() {
    // Chat - bidirectional
    it(ChatSchema) satisfies Chat;
    is(it<Chat>(), ChatSchema);
}

/**
 * Test Character/Lorebook types
 */
function testLorebookTypes() {
    // LorebookCondition - bidirectional (using satisfies due to complex union types)
    it(LorebookConditionSchema) satisfies LorebookCondition;
    it<LorebookCondition>() satisfies z.infer<typeof LorebookConditionSchema>;

    // LorebookData - bidirectional
    is(it(LorebookDataSchema), it<LorebookData>());

    // LorebookEntry - bidirectional (using satisfies due to nested complexity)
    it(LorebookEntrySchema) satisfies LorebookEntry;
    it<LorebookEntry>() satisfies z.infer<typeof LorebookEntrySchema>;
}

/**
 * Test Character/Message types
 */
function testMessageTypes() {
    // Message - bidirectional
    is(MessageSchema, it<Message>());

    // Role - bidirectional
    is(RoleSchema, it<Role>());
}

/**
 * Test Character/Meta types
 */
function testMetaTypes() {
    // Meta - bidirectional
    it(MetaSchema) satisfies Meta;
    it<Meta>() satisfies z.infer<typeof MetaSchema>;
}

/**
 * Test Executables types
 */
function testExecutablesTypes() {
    // ScriptSetting - bidirectional
    it(ScriptSettingSchema) satisfies ScriptSetting;
    is(it<ScriptSetting>(), ScriptSettingSchema);

    // ReplaceHook - bidirectional
    it(ReplaceHookSchema) satisfies ReplaceHook;
    it<ReplaceHook>() satisfies z.infer<typeof ReplaceHookSchema>;

    // ReplaceHookEntity - bidirectional
    it(ReplaceHookEntitySchema) satisfies ReplaceHookEntity;
    it<ReplaceHookEntity>() satisfies z.infer<typeof ReplaceHookEntitySchema>;

    // ReplaceHookMeta - bidirectional
    it(ReplaceHookMetaSchema) satisfies ReplaceHookMeta;
    it<ReplaceHookMeta>() satisfies z.infer<typeof ReplaceHookMetaSchema>;
}

/**
 * Test Utils types
 */
function testUtilsTypes() {
    // FileType - bidirectional
    is(FileSchema, it<FileType>());

    // ImageURL - bidirectional
    is(ImageURLSchema, it<ImageURL>());

    // Uint8ArrayType - bidirectional
    is(Uint8ArraySchema, it<Uint8ArrayType>());
}

// =============================================================================
// Run all tests
// =============================================================================

function runAllTests() {
    testAssetsTypes();
    testCharacterTypes();
    testChatTypes();
    testLorebookTypes();
    testMessageTypes();
    testMetaTypes();
    testExecutablesTypes();
    testUtilsTypes();
}

runAllTests();

console.log("✅ Type compatibility tests passed!");
console.log(
    "   All z.infer<Schema> types are compatible with generated types.",
);
