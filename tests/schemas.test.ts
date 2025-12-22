import { describe, expect, it } from "vitest";
import { FileSchema, ImageURLSchema, positiveInteger } from "@/types/v0";
import { CharacterSchema } from "@/types/v0/Character";
import { AssetsSettingSchema } from "@/types/v0/Character/Assets";
import {
    LorebookDataSchema,
    LorebookEntrySchema,
} from "@/types/v0/Character/Lorebook";
import { MetaSchema } from "@/types/v0/Character/Meta";
import { ScriptSettingSchema } from "@/types/v0/Executables/Executable";
import {
    ReplaceHookMetaSchema,
    ReplaceHookSchema,
} from "@/types/v0/Executables/ReplaceHook";

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

    it("ScriptSettingSchema applies default timeout (timout) in runtimeSetting", () => {
        const parsed = ScriptSettingSchema.parse({});
        expect(parsed.runtimeSetting).toBeDefined();
        // default field is named `timout` in the schema
        // ensure default value is applied
        expect(parsed.runtimeSetting.timout).toBe(3);
    });

    it("AssetsSettingSchema enforces unique names and accepts valid assets", () => {
        const valid = {
            assets: [
                {
                    mimeType: "image/png",
                    name: "a.png",
                    data: "http://example.com/a.png",
                },
                {
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
                    mimeType: "image/png",
                    name: "dup.png",
                    data: "http://example.com/a.png",
                },
                {
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

    it("positiveInteger accepts 1 and rejects 0", () => {
        expect(() => positiveInteger.parse(1)).not.toThrow();
        expect(() => positiveInteger.parse(0)).toThrow();
    });

    it("LorebookDataSchema rejects tokenLimit=0 in config (positiveInteger)", () => {
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
