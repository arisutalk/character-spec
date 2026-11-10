/**
 * Detailed type tests of the generated declarations, using expectTypeOf.
 *
 * The assertions are checked by the type checker (`pnpm test:types`),
 * against the declarations of the build (`dist/v0`), i.e. what consumers see.
 * Needs `pnpm build` first.
 */

import { describe, expectTypeOf, test } from "vitest";
import type * as z from "zod";

import type {
    AssetEntitySchema,
    AssetsSettingSchema,
    CharacterPromptDataSchema,
    CharacterSchema,
    FileSchema,
    ImageURLSchema,
    InstructionSchema,
    LorebookConditionSchema,
    MessageSchema,
    MetaSchema,
    RoleSchema,
} from "@/types/v0";

import type {
    AssetEntity,
    AssetsSetting,
    Character,
    CharacterPromptData,
    FileType,
    ImageURL,
    Instruction,
    LorebookCondition,
    Message,
    Meta,
    Role,
} from "../dist/v0";

describe("Character Type Details", () => {
    test("Character has all required fields", () => {
        expectTypeOf<Character>().toHaveProperty("specVersion");
        expectTypeOf<Character>().toHaveProperty("id");
        expectTypeOf<Character>().toHaveProperty("name");
        expectTypeOf<Character>().toHaveProperty("description");
        expectTypeOf<Character>().toHaveProperty("prompt");
        expectTypeOf<Character>().toHaveProperty("executables");
        expectTypeOf<Character>().toHaveProperty("metadata");
        expectTypeOf<Character>().toHaveProperty("assets");
    });

    test("Character.specVersion is literal 0", () => {
        expectTypeOf<Character["specVersion"]>().toEqualTypeOf<0>();
        expectTypeOf<Character["specVersion"]>().not.toEqualTypeOf<number>();
    });

    test("Character.id is string", () => {
        expectTypeOf<Character["id"]>().toBeString();
        expectTypeOf<Character["id"]>().not.toBeNumber();
    });

    test("Character.avatarUrl is optional string", () => {
        expectTypeOf<Character["avatarUrl"]>().toEqualTypeOf<
            string | undefined
        >();
    });

    test("Character matches Zod inferred type", () => {
        expectTypeOf<Character>().toEqualTypeOf<
            z.infer<typeof CharacterSchema>
        >();
    });

    test("CharacterPromptData has correct structure", () => {
        expectTypeOf<CharacterPromptData>().toHaveProperty("description");
        expectTypeOf<CharacterPromptData>().toHaveProperty("authorsNote");
        expectTypeOf<CharacterPromptData>().toHaveProperty("lorebook");
    });

    test("CharacterPromptData.authorsNote is optional", () => {
        expectTypeOf<CharacterPromptData["authorsNote"]>().toEqualTypeOf<
            string | undefined
        >();
    });
});

describe("Meta Type Details", () => {
    test("Meta has all fields", () => {
        expectTypeOf<Meta>().toHaveProperty("author");
        expectTypeOf<Meta>().toHaveProperty("license");
        expectTypeOf<Meta>().toHaveProperty("version");
        expectTypeOf<Meta>().toHaveProperty("distributedOn");
        expectTypeOf<Meta>().toHaveProperty("additionalInfo");
    });

    test("Meta.author is optional string", () => {
        expectTypeOf<Meta["author"]>().toEqualTypeOf<string | undefined>();
    });

    test("Meta.license has default value but is still a string", () => {
        expectTypeOf<Meta["license"]>().toBeString();
        expectTypeOf<Meta["license"]>().not.toEqualTypeOf<"ARR">();
    });

    test("Meta matches Zod inferred type", () => {
        expectTypeOf<Meta>().toEqualTypeOf<z.infer<typeof MetaSchema>>();
    });
});

describe("Assets Type Details", () => {
    test("AssetEntity has required fields", () => {
        expectTypeOf<AssetEntity>().toHaveProperty("id");
        expectTypeOf<AssetEntity>().toHaveProperty("mimeType");
        expectTypeOf<AssetEntity>().toHaveProperty("name");
        expectTypeOf<AssetEntity>().toHaveProperty("data");
    });

    test("AssetEntity.id and mimeType are strings", () => {
        expectTypeOf<AssetEntity["id"]>().toBeString();
        expectTypeOf<AssetEntity["mimeType"]>().toBeString();
    });

    test("AssetEntity.data is FileType", () => {
        expectTypeOf<AssetEntity["data"]>().toEqualTypeOf<FileType>();
    });

    test("AssetsSetting.assets is a mutable array of AssetEntity", () => {
        expectTypeOf<AssetsSetting["assets"]>().toEqualTypeOf<AssetEntity[]>();
        expectTypeOf<AssetsSetting["assets"]>().not.toEqualTypeOf<
            readonly AssetEntity[]
        >();
    });

    test("AssetsSetting and AssetEntity match Zod inferred types", () => {
        expectTypeOf<AssetsSetting>().toEqualTypeOf<
            z.infer<typeof AssetsSettingSchema>
        >();
        expectTypeOf<AssetEntity>().toEqualTypeOf<
            z.infer<typeof AssetEntitySchema>
        >();
    });
});

describe("Message Type Details", () => {
    test("Role is a union of specific strings", () => {
        expectTypeOf<Role>().toEqualTypeOf<"user" | "assistant" | "system">();
        expectTypeOf<Role>().not.toEqualTypeOf<string>();
    });

    test("Message.role is Role", () => {
        expectTypeOf<Message["role"]>().toEqualTypeOf<Role>();
    });

    test("Message.content is a text or file content, discriminated by type", () => {
        expectTypeOf<Message["content"]["type"]>().toEqualTypeOf<
            "text" | "file"
        >();
        expectTypeOf<
            Extract<Message["content"], { type: "text" }>["data"]
        >().toBeString();
        expectTypeOf<
            Extract<Message["content"], { type: "file" }>["data"]
        >().toEqualTypeOf<FileType>();
    });

    test("Message.inlays are AssetEntity", () => {
        expectTypeOf<Message["inlays"]>().toEqualTypeOf<AssetEntity[]>();
    });

    test("Message and Role match Zod inferred types", () => {
        expectTypeOf<Message>().toEqualTypeOf<z.infer<typeof MessageSchema>>();
        expectTypeOf<Role>().toEqualTypeOf<z.infer<typeof RoleSchema>>();
    });
});

describe("Lorebook Type Details", () => {
    test("LorebookCondition covers every condition type", () => {
        expectTypeOf<LorebookCondition["type"]>().toEqualTypeOf<
            "regex_match" | "plain_text_match" | "always" | "custom"
        >();
    });

    test("the custom condition carries optional string data", () => {
        expectTypeOf<
            Extract<LorebookCondition, { type: "custom" }>["data"]
        >().toEqualTypeOf<string | undefined>();
    });

    test("LorebookCondition matches Zod inferred type", () => {
        expectTypeOf<LorebookCondition>().toEqualTypeOf<
            z.infer<typeof LorebookConditionSchema>
        >();
    });
});

describe("Instruction Type Details", () => {
    test("Instruction has the expected fields", () => {
        expectTypeOf<Instruction["specVersion"]>().toBeNumber();
        expectTypeOf<Instruction["id"]>().toBeString();
        expectTypeOf<Instruction["description"]>().toEqualTypeOf<
            string | undefined
        >();
        expectTypeOf<Instruction["condition"]>().toEqualTypeOf<
            LorebookCondition[]
        >();
        expectTypeOf<Instruction["enabled"]>().toBeBoolean();
        expectTypeOf<Instruction["metadata"]>().toEqualTypeOf<Meta>();
    });

    test("Instruction matches Zod inferred type", () => {
        expectTypeOf<Instruction>().toEqualTypeOf<
            z.infer<typeof InstructionSchema>
        >();
    });
});

describe("Utils Type Details", () => {
    test("ImageURL is a string", () => {
        expectTypeOf<ImageURL>().toBeString();
    });

    test("FileType is a string or a Uint8Array", () => {
        expectTypeOf<FileType>().toEqualTypeOf<
            string | Uint8Array<ArrayBuffer>
        >();
    });

    test("ImageURL and Uint8Array are assignable to FileType", () => {
        expectTypeOf<ImageURL>().toExtend<FileType>();
        expectTypeOf<Uint8Array<ArrayBuffer>>().toExtend<FileType>();
    });

    test("a Uint8Array backed by a SharedArrayBuffer is not a FileType", () => {
        expectTypeOf<Uint8Array<SharedArrayBuffer>>().not.toExtend<FileType>();
    });

    test("FileType and ImageURL match Zod inferred types", () => {
        expectTypeOf<FileType>().toEqualTypeOf<z.infer<typeof FileSchema>>();
        expectTypeOf<ImageURL>().toEqualTypeOf<
            z.infer<typeof ImageURLSchema>
        >();
    });
});

describe("Type Relationships", () => {
    test("Character.prompt is CharacterPromptData", () => {
        expectTypeOf<
            Character["prompt"]
        >().toEqualTypeOf<CharacterPromptData>();
    });

    test("Character.metadata is Meta", () => {
        expectTypeOf<Character["metadata"]>().toEqualTypeOf<Meta>();
    });

    test("Character.assets is AssetsSetting", () => {
        expectTypeOf<Character["assets"]>().toEqualTypeOf<AssetsSetting>();
    });

    test("CharacterPromptData matches Zod inferred type", () => {
        expectTypeOf<CharacterPromptData>().toEqualTypeOf<
            z.infer<typeof CharacterPromptDataSchema>
        >();
    });
});

describe("Optionality", () => {
    test("Character.avatarUrl can be omitted, but is not nullable", () => {
        // `exactOptionalPropertyTypes` is on: optional keys spell out `| undefined`
        expectTypeOf<Pick<Character, "avatarUrl">>().toEqualTypeOf<{
            avatarUrl?: string | undefined;
        }>();
        expectTypeOf<Character["avatarUrl"]>().not.toEqualTypeOf<
            string | null | undefined
        >();
    });

    test("Meta.author is optional but not nullable", () => {
        expectTypeOf<Meta["author"]>().not.toEqualTypeOf<string | null>();
    });
});
