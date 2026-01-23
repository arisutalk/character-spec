/**
 * Detailed type tests using expectTypeOf from Vitest
 * Tests various edge cases and type relationships
 */

import { describe, expectTypeOf, test } from "vitest";
import type { z } from "zod";
import type {
    AssetEntity,
    AssetsSetting,
} from "../src/types/v0/Character/Assets";
import {
    AssetEntitySchema,
    AssetsSettingSchema,
} from "../src/types/v0/Character/Assets";
import type {
    Character,
    CharacterPromptData,
} from "../src/types/v0/Character/Character";
import {
    CharacterPromptDataSchema,
    CharacterSchema,
} from "../src/types/v0/Character/Character";
import type { Message, Role } from "../src/types/v0/Character/Message";
import { MessageSchema, RoleSchema } from "../src/types/v0/Character/Message";
import type { Meta } from "../src/types/v0/Character/Meta";
import { MetaSchema } from "../src/types/v0/Character/Meta";
import type { FileType, ImageURL } from "../src/types/v0/utils";
import { FileSchema, ImageURLSchema } from "../src/types/v0/utils";

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
    test("Meta has all optional fields", () => {
        expectTypeOf<Meta>().toHaveProperty("author");
        expectTypeOf<Meta>().toHaveProperty("license");
        expectTypeOf<Meta>().toHaveProperty("version");
        expectTypeOf<Meta>().toHaveProperty("distributedOn");
        expectTypeOf<Meta>().toHaveProperty("additionalInfo");
    });

    test("Meta.author is optional string", () => {
        expectTypeOf<Meta["author"]>().toEqualTypeOf<string | undefined>();
    });

    test("Meta.license has default value", () => {
        expectTypeOf<Meta["license"]>().toBeString();
        // license has default "ARR" but type is still string
        expectTypeOf<Meta["license"]>().not.toEqualTypeOf<"ARR">();
    });

    test("Meta matches Zod inferred type", () => {
        expectTypeOf<Meta>().toEqualTypeOf<z.infer<typeof MetaSchema>>();
    });

    test("Meta can be empty object", () => {
        expectTypeOf<{}>().toMatchTypeOf<Meta>();
    });
});

describe("Assets Type Details", () => {
    test("AssetEntity has required fields", () => {
        expectTypeOf<AssetEntity>().toHaveProperty("id");
        expectTypeOf<AssetEntity>().toHaveProperty("mimeType");
        expectTypeOf<AssetEntity>().toHaveProperty("name");
        expectTypeOf<AssetEntity>().toHaveProperty("data");
    });

    test("AssetEntity.id is string", () => {
        expectTypeOf<AssetEntity["id"]>().toBeString();
    });

    test("AssetEntity.mimeType is string", () => {
        expectTypeOf<AssetEntity["mimeType"]>().toBeString();
    });

    test("AssetEntity.data is FileType", () => {
        expectTypeOf<AssetEntity["data"]>().toEqualTypeOf<FileType>();
    });

    test("AssetsSetting.assets is array", () => {
        expectTypeOf<AssetsSetting["assets"]>().toBeArray();
        expectTypeOf<AssetsSetting["assets"]>().toEqualTypeOf<AssetEntity[]>();
    });

    test("AssetsSetting matches Zod inferred type", () => {
        expectTypeOf<AssetsSetting>().toEqualTypeOf<
            z.infer<typeof AssetsSettingSchema>
        >();
    });

    test("AssetEntity matches Zod inferred type", () => {
        expectTypeOf<AssetEntity>().toEqualTypeOf<
            z.infer<typeof AssetEntitySchema>
        >();
    });
});

describe("Message Type Details", () => {
    test("Role is union of specific strings", () => {
        expectTypeOf<Role>().toEqualTypeOf<"user" | "assistant" | "system">();
    });

    test("Role is not just any string", () => {
        expectTypeOf<Role>().not.toEqualTypeOf<string>();
    });

    test("Message has required fields", () => {
        expectTypeOf<Message>().toHaveProperty("role");
        expectTypeOf<Message>().toHaveProperty("content");
    });

    test("Message.role is Role type", () => {
        expectTypeOf<Message["role"]>().toEqualTypeOf<Role>();
    });

    test("Message.content is string", () => {
        expectTypeOf<Message["content"]>().toBeString();
    });

    test("Message matches Zod inferred type", () => {
        expectTypeOf<Message>().toEqualTypeOf<z.infer<typeof MessageSchema>>();
    });

    test("Role matches Zod inferred type", () => {
        expectTypeOf<Role>().toEqualTypeOf<z.infer<typeof RoleSchema>>();
    });
});

describe("Utils Type Details", () => {
    test("FileType is union of ImageURL and Uint8Array", () => {
        expectTypeOf<FileType>().toMatchTypeOf<ImageURL | Uint8Array>();
    });

    test("ImageURL is object with url", () => {
        expectTypeOf<ImageURL>().toHaveProperty("url");
    });

    test("ImageURL.url is string", () => {
        expectTypeOf<ImageURL["url"]>().toBeString();
    });

    test("FileType matches Zod inferred type", () => {
        expectTypeOf<FileType>().toEqualTypeOf<z.infer<typeof FileSchema>>();
    });

    test("ImageURL matches Zod inferred type", () => {
        expectTypeOf<ImageURL>().toEqualTypeOf<
            z.infer<typeof ImageURLSchema>
        >();
    });

    test("Uint8Array is assignable to FileType", () => {
        expectTypeOf<Uint8Array>().toMatchTypeOf<FileType>();
    });

    test("ImageURL is assignable to FileType", () => {
        expectTypeOf<ImageURL>().toMatchTypeOf<FileType>();
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

describe("Readonly and Mutability", () => {
    test("Character type is not readonly", () => {
        type IsReadonly<T> = T extends Readonly<T> ? true : false;
        expectTypeOf<IsReadonly<Character>>().toEqualTypeOf<false>();
    });

    test("AssetEntity array can be mutated", () => {
        expectTypeOf<AssetsSetting["assets"]>().not.toMatchTypeOf<
            readonly AssetEntity[]
        >();
    });
});

describe("Nullability and Optionality", () => {
    test("Character.avatarUrl can be undefined", () => {
        expectTypeOf<Character>().toMatchTypeOf<{ avatarUrl?: string }>();
    });

    test("Character.avatarUrl cannot be null", () => {
        expectTypeOf<Character["avatarUrl"]>().not.toEqualTypeOf<
            string | null | undefined
        >();
    });

    test("Meta fields are optional but not nullable", () => {
        expectTypeOf<Meta["author"]>().toEqualTypeOf<string | undefined>();
        expectTypeOf<Meta["author"]>().not.toEqualTypeOf<string | null>();
    });

    test("CharacterPromptData.authorsNote is optional", () => {
        expectTypeOf<CharacterPromptData>().toMatchTypeOf<{
            authorsNote?: string;
        }>();
    });
});

describe("Type Narrowing", () => {
    test("Role can be narrowed to specific values", () => {
        const role: Role = "user";
        expectTypeOf(role).toEqualTypeOf<Role>();
        expectTypeOf<typeof role>().toMatchTypeOf<"user">();
    });

    test("FileType can be narrowed to ImageURL", () => {
        const file: FileType = { url: "https://example.com/image.png" };
        expectTypeOf(file).toEqualTypeOf<FileType>();
        expectTypeOf<typeof file>().toMatchTypeOf<ImageURL>();
    });

    test("FileType can be narrowed to Uint8Array", () => {
        const file: FileType = new Uint8Array([1, 2, 3]);
        expectTypeOf(file).toEqualTypeOf<FileType>();
        expectTypeOf<typeof file>().toMatchTypeOf<Uint8Array>();
    });
});
