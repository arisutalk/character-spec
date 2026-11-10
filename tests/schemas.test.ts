import { describe, expect, it } from "vitest";

import { characterMap } from "@/index";
import {
    AssetsSettingSchema,
    CharacterSchema,
    ChatSchema,
    FileSchema,
    ImageURLSchema,
    LorebookDataSchema,
    LorebookEntrySchema,
    MetaSchema,
    positiveIntegerSchema,
    ReplaceHookEntitySchema,
    ReplaceHookMetaSchema,
    ReplaceHookSchema,
    RoleSchema,
    ScriptSettingSchema,
} from "@/types/v0";

describe("Schema basics", () => {
    it("MetaSchema provides default license when omitted", () => {
        const parsed = MetaSchema.parse({});
        expect(parsed.license).toBe("ARR");
    });

    it("LorebookEntrySchema gives default empty condition and requires required fields", () => {
        const minimal = { id: "1", name: "entry", content: "some" };
        const parsed = LorebookEntrySchema.parse(minimal);

        // defaulted array
        expect(Array.isArray(parsed.condition)).toBe(true);
        expect(parsed.condition.length).toBe(0);

        // missing required fields should throw
        expect(() => LorebookEntrySchema.parse({})).toThrow();
    });

    it("LorebookDataSchema provides defaults for data/config", () => {
        const parsed = LorebookDataSchema.parse({});
        expect(Array.isArray(parsed.data)).toBe(true);
        expect(parsed.data.length).toBe(0);
        expect(parsed.config).toBeDefined();
    });

    it("ReplaceHookSchema instantiates with empty arrays by default", () => {
        const parsed = ReplaceHookSchema.parse({});
        expect(Array.isArray(parsed.input)).toBe(true);
        expect(Array.isArray(parsed.output)).toBe(true);
        expect(Array.isArray(parsed.display)).toBe(true);
        expect(Array.isArray(parsed.request)).toBe(true);
    });

    it("ScriptSettingSchema applies default timeout (timeout) in runtimeSetting", () => {
        const parsed = ScriptSettingSchema.parse({});
        expect(parsed.runtimeSetting).toBeDefined();
        // default field is named `timeout` in the schema
        // ensure default value is applied
        expect(parsed.runtimeSetting.timeout).toBe(3);
    });

    it("AssetsSettingSchema enforces unique ids and accepts valid assets", () => {
        const valid = {
            assets: [
                {
                    id: "asset-1",
                    mimeType: "image/png",
                    name: "a.png",
                    data: "http://example.com/a.png",
                },
                {
                    id: "asset-2",
                    mimeType: "image/png",
                    name: "b.png",
                    data: "http://example.com/b.png",
                },
            ],
        };

        expect(() => AssetsSettingSchema.parse(valid)).not.toThrow();

        const invalid = {
            assets: [
                {
                    id: "asset-dup-1",
                    mimeType: "image/png",
                    name: "dup.png",
                    data: "http://example.com/a.png",
                },
                {
                    id: "asset-dup-1",
                    mimeType: "image/png",
                    name: "dup.png",
                    data: "http://example.com/b.png",
                },
            ],
        };

        expect(() => AssetsSettingSchema.parse(invalid)).toThrow();
    });
    it("can instantiate a minimal CharacterSchema object and applies nested defaults", () => {
        const minimal = {
            specVersion: 0,
            id: "c1",
            name: "Test",
            description: "desc",
            prompt: { description: "p", lorebook: {} },
            executables: {},
            metadata: {},
            assets: { assets: [] },
        };

        const parsed = CharacterSchema.parse(minimal);
        expect(parsed.specVersion).toBe(0);
        expect(parsed.prompt).toBeDefined();
        expect(parsed.executables).toBeDefined();
    });

    it("CharacterSchema keeps avatarUrl as is while it trims the asset ids", () => {
        const avatar = "local://opfs/avatar.png";
        const parsed = CharacterSchema.parse({
            specVersion: 0,
            id: "c1",
            name: "Test",
            description: "desc",
            avatarUrl: avatar,
            prompt: { description: "p", lorebook: {} },
            executables: {},
            metadata: {},
            assets: {
                assets: [
                    {
                        id: " avatar ",
                        mimeType: "image/png",
                        name: "avatar.png",
                        data: avatar,
                    },
                ],
            },
        });
        // avatarUrl refers to the `data` of an asset, never to its id
        expect(parsed.avatarUrl).toBe(avatar);
        expect(parsed.assets.assets[0]?.id).toBe("avatar");
        expect(
            parsed.assets.assets.some(
                (asset) => asset.data === parsed.avatarUrl,
            ),
        ).toBe(true);
    });

    it("CharacterSchema throws if required top-level fields are missing", () => {
        expect(() => CharacterSchema.parse({})).toThrow();
    });

    it("ImageURLSchema accepts valid http urls and rejects invalid strings", () => {
        expect(() =>
            ImageURLSchema.parse("http://example.com/img.png"),
        ).not.toThrow();
        expect(() => ImageURLSchema.parse("not-a-url")).toThrow();
    });

    it("FileSchema accepts both URL strings and Uint8Array instances", () => {
        expect(() =>
            FileSchema.parse("http://example.com/a.png"),
        ).not.toThrow();
        expect(() => FileSchema.parse(new Uint8Array([1, 2, 3]))).not.toThrow();
    });

    it("positiveIntegerSchema accepts 1 and rejects 0", () => {
        expect(() => positiveIntegerSchema.parse(1)).not.toThrow();
        expect(() => positiveIntegerSchema.parse(0)).toThrow();
    });

    it("LorebookDataSchema rejects tokenLimit=0 in config (positiveIntegerSchema)", () => {
        expect(() =>
            LorebookDataSchema.parse({ config: { tokenLimit: 0 } }),
        ).toThrow();
    });

    it("ReplaceHookMetaSchema applies defaults for string type when minimal input provided", () => {
        const parsed = ReplaceHookMetaSchema.parse({ type: "string" });
        // caseSensitive default true and priority default 0 should be present
        // Types are loose here so check keys
        expect(parsed).toHaveProperty("caseSensitive");
        expect(parsed).toHaveProperty("priority");
    });
});

describe("Chat and roles", () => {
    it("ChatSchema fills the title and both timestamps when omitted", () => {
        const parsed = ChatSchema.parse({ id: "chat-1", characterId: "c1" });
        expect(parsed.title).toBe("Chat");
        expect(typeof parsed.createdAt).toBe("number");
        expect(typeof parsed.updatedAt).toBe("number");
        // the lorebook entries array carries its own default
        expect(parsed.lorebook).toEqual([]);
    });

    it("ChatSchema keeps the given values and accepts a chat specific lorebook", () => {
        const parsed = ChatSchema.parse({
            id: "chat-1",
            characterId: "c1",
            title: "My chat",
            createdAt: 1,
            updatedAt: 2,
            lorebook: [{ id: "1", name: "entry", content: "some" }],
        });
        expect(parsed.title).toBe("My chat");
        expect(parsed.createdAt).toBe(1);
        expect(parsed.updatedAt).toBe(2);
        expect(parsed.lorebook?.[0]?.condition).toEqual([]);
    });

    it("ChatSchema requires its identifiers", () => {
        expect(() => ChatSchema.parse({ id: "chat-1" })).toThrow();
        expect(() => ChatSchema.parse({ characterId: "c1" })).toThrow();
    });

    it("RoleSchema accepts user, assistant and system only", () => {
        for (const role of ["user", "assistant", "system"]) {
            expect(RoleSchema.parse(role)).toBe(role);
        }
        expect(() => RoleSchema.parse("tool")).toThrow();
        expect(() => RoleSchema.parse("")).toThrow();
    });
});

describe("ReplaceHookEntitySchema", () => {
    it("fills the meta defaults of a string hook", () => {
        const parsed = ReplaceHookEntitySchema.parse({
            input: "foo",
            meta: { type: "string" },
            output: "bar",
        });
        expect(parsed.meta).toMatchObject({
            type: "string",
            caseSensitive: true,
            isInputPatternScripted: false,
            isOutputScripted: false,
            priority: 0,
        });
    });

    it("accepts a regex hook with a flag and rejects one without", () => {
        const regex = {
            input: "a+",
            meta: { type: "regex", flag: "gi" },
            output: "b",
        };
        expect(ReplaceHookEntitySchema.parse(regex).meta).toMatchObject({
            type: "regex",
            flag: "gi",
        });
        expect(() =>
            ReplaceHookEntitySchema.parse({
                ...regex,
                meta: { type: "regex" },
            }),
        ).toThrow();
    });

    it("requires input, meta and output", () => {
        expect(() =>
            ReplaceHookEntitySchema.parse({
                meta: { type: "string" },
                output: "",
            }),
        ).toThrow();
        expect(() =>
            ReplaceHookEntitySchema.parse({ input: "", output: "" }),
        ).toThrow();
    });
});

describe("Spec version map", () => {
    it("characterMap resolves version 0 to the character schema", () => {
        expect(characterMap[0]).toBe(CharacterSchema);
    });
});
