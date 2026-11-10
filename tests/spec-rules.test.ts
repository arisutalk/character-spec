import { describe, expect, it } from "vitest";

import {
    AssetEntitySchema,
    AssetsSettingSchema,
    InstructionSchema,
    LorebookConditionSchema,
    LorebookDataSchema,
    LorebookEntrySchema,
    MessageSchema,
} from "@/types/v0";

const asset = (id: string, name = "a.png") => ({
    id,
    mimeType: "image/png",
    name,
    data: "http://example.com/a.png",
});

describe("Asset ids", () => {
    it("trims the id", () => {
        expect(AssetEntitySchema.parse(asset("  asset-1 \n")).id).toBe(
            "asset-1",
        );
    });

    it("detects duplicated ids after trimming", () => {
        expect(() =>
            AssetsSettingSchema.parse({
                assets: [
                    asset("asset-1", "a.png"),
                    asset(" asset-1 ", "b.png"),
                ],
            }),
        ).toThrow(/Not unique key: id/);
    });

    it("allows the same name when ids differ", () => {
        const parsed = AssetsSettingSchema.parse({
            assets: [
                asset("asset-1", "same.png"),
                asset("asset-2", "same.png"),
            ],
        });
        expect(parsed.assets).toHaveLength(2);
    });

    it("rejects the same id even when names differ", () => {
        expect(() =>
            AssetsSettingSchema.parse({
                assets: [asset("asset-1", "a.png"), asset("asset-1", "b.png")],
            }),
        ).toThrow(/Not unique key: id/);
    });
});

describe("Message inlays", () => {
    const message = (inlays: unknown) => ({
        id: "m1",
        chatId: "c1",
        role: "user",
        content: { type: "text", data: "hello" },
        inlays,
    });

    it("rejects inlays with the same id, even when names differ", () => {
        expect(() =>
            MessageSchema.parse(
                message([asset("inlay-1", "a.png"), asset("inlay-1", "b.png")]),
            ),
        ).toThrow(/Not unique key: id/);
    });

    it("accepts inlays with the same name but different ids", () => {
        const parsed = MessageSchema.parse(
            message([
                asset("inlay-1", "same.png"),
                asset("inlay-2", "same.png"),
            ]),
        );
        expect(parsed.inlays.map((i) => i.id)).toEqual(["inlay-1", "inlay-2"]);
    });

    it("trims inlay ids", () => {
        const parsed = MessageSchema.parse(message([asset(" inlay-1 ")]));
        expect(parsed.inlays[0]?.id).toBe("inlay-1");
    });

    it("keeps binary inlay data as Uint8Array", () => {
        const data = new Uint8Array([1, 2, 3]);
        const parsed = MessageSchema.parse(
            message([{ ...asset("inlay-1"), data }]),
        );
        expect(parsed.inlays[0]?.data).toBeInstanceOf(Uint8Array);
    });
});

describe("Lorebook conditions", () => {
    it("accepts the custom condition without data", () => {
        expect(LorebookConditionSchema.parse({ type: "custom" })).toEqual({
            type: "custom",
        });
    });

    it("accepts the custom condition with data", () => {
        expect(
            LorebookConditionSchema.parse({ type: "custom", data: "{}" }),
        ).toEqual({ type: "custom", data: "{}" });
    });

    it("rejects non-string custom data", () => {
        expect(() =>
            LorebookConditionSchema.parse({ type: "custom", data: 1 }),
        ).toThrow();
    });

    it("rejects unknown condition types", () => {
        expect(() => LorebookConditionSchema.parse({ type: "nope" })).toThrow();
    });

    it("accepts every condition type inside an entry", () => {
        const parsed = LorebookEntrySchema.parse({
            id: "1",
            name: "entry",
            content: "text",
            condition: [
                { type: "always" },
                { type: "plain_text_match", text: "a" },
                { type: "regex_match", regexPattern: "a+" },
                { type: "custom" },
            ],
        });
        expect(parsed.condition.map((c) => c.type)).toEqual([
            "always",
            "plain_text_match",
            "regex_match",
            "custom",
        ]);
    });

    it("rejects duplicated entry ids in a lorebook", () => {
        const entry = { id: "1", name: "entry", content: "text" };
        expect(() =>
            LorebookDataSchema.parse({
                data: [entry, { ...entry, name: "b" }],
            }),
        ).toThrow(/Not unique key: id/);
    });
});

describe("Instruction", () => {
    const minimal = {
        id: "i1",
        name: "Be brief",
        content: "Answer briefly.",
    };

    it("fills defaults", () => {
        const parsed = InstructionSchema.parse(minimal);
        expect(parsed).toMatchObject({
            specVersion: 0,
            condition: [],
            priority: 0,
            enabled: true,
            metadata: { license: "ARR" },
        });
        expect(parsed.description).toBeUndefined();
    });

    it.each([
        ["id", { name: minimal.name, content: minimal.content }],
        ["name", { id: minimal.id, content: minimal.content }],
        ["content", { id: minimal.id, name: minimal.name }],
    ])("requires %s", (_key, input) => {
        expect(() => InstructionSchema.parse(input)).toThrow();
    });

    it("shares the lorebook conditions, custom included", () => {
        const parsed = InstructionSchema.parse({
            ...minimal,
            condition: [{ type: "always" }, { type: "custom", data: "x" }],
        });
        expect(parsed.condition).toHaveLength(2);
        expect(() =>
            InstructionSchema.parse({ ...minimal, condition: [{ type: "?" }] }),
        ).toThrow();
    });

    it("rejects a non-numeric priority", () => {
        expect(() =>
            InstructionSchema.parse({ ...minimal, priority: "high" }),
        ).toThrow();
    });

    it("keeps provided metadata", () => {
        const parsed = InstructionSchema.parse({
            ...minimal,
            metadata: { author: "me", license: "MIT" },
        });
        expect(parsed.metadata).toMatchObject({
            author: "me",
            license: "MIT",
        });
    });
});
