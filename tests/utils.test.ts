import { describe, expect, it } from "vitest";
import { type Message, MessageSchema } from "@/types/v0";
import { unique } from "@/types/v0/utils";
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
