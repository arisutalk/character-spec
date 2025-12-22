import { describe, expect, it } from "vitest";
import { unique } from "@/types/v0/utils";

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
