import { describe, expect, it } from "vitest";
import * as z from "zod";

import { type Message, MessageSchema, unique, uniqueIdArray } from "@/types/v0";
import { apply } from "@/utils";

describe("unique helper", () => {
    it("returns true for arrays with unique key values", () => {
        const arr = [{ name: "alice" }, { name: "bob" }];
        const checker = unique("name");

        expect(checker(arr)).toBe(true);
    });

    it("returns false for arrays with duplicate key values", () => {
        const arr = [{ name: "alice" }, { name: "alice" }];
        const checker = unique("name");

        expect(checker(arr)).toBe(false);
    });
});
describe("apply helper", () => {
    it("fills default keys", () => {
        const message: Message = apply(MessageSchema, {
            id: "1",
            chatId: "chat1",
            role: "user",
            content: {
                type: "text",
                data: "hello",
            },
        });
        expect(message.timestamp).toBeDefined();
        expect(Array.isArray(message.inlays)).toBe(true);
        expect(message.inlays.length).toBe(0);
    });
});

describe("uniqueIdArray helper", () => {
    const schema = uniqueIdArray(z.object({ id: z.string(), v: z.number() }));

    it("defaults to an empty array", () => {
        expect(schema.parse(undefined)).toEqual([]);
    });

    it("accepts unique ids, whatever the other fields are", () => {
        expect(
            schema.parse([
                { id: "a", v: 1 },
                { id: "b", v: 1 },
            ]),
        ).toHaveLength(2);
    });

    it("rejects duplicated ids, whatever the other fields are", () => {
        expect(() =>
            schema.parse([
                { id: "a", v: 1 },
                { id: "a", v: 2 },
            ]),
        ).toThrow(/Not unique key: id/);
    });

    it("still validates the items", () => {
        expect(() => schema.parse([{ id: "a" }])).toThrow();
    });
});
