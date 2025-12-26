import { describe, expect, it } from "vitest";
import { Uint8ArraySchema } from "../src/types/v0/utils";

describe("Uint8ArraySchema", () => {
    it("accepts Uint8Array with ArrayBuffer", () => {
        const buffer = new ArrayBuffer(8);
        const uint8Array = new Uint8Array(buffer);
        expect(() => Uint8ArraySchema.parse(uint8Array)).not.toThrow();
    });

    it("rejects Uint8Array with SharedArrayBuffer", () => {
        // SharedArrayBuffer might not be available in all environments, 
        // but Vitest/Node usually supports it if started with correct flags or by default in recent versions.
        if (typeof SharedArrayBuffer !== "undefined") {
            const sharedBuffer = new SharedArrayBuffer(8);
            const uint8Array = new Uint8Array(sharedBuffer);
            expect(() => Uint8ArraySchema.parse(uint8Array)).toThrow();
        } else {
            console.warn("SharedArrayBuffer is not defined in this environment, skipping rejection test.");
        }
    });

    it("rejects other types", () => {
        expect(() => Uint8ArraySchema.parse("not a uint8array")).toThrow();
        expect(() => Uint8ArraySchema.parse({})).toThrow();
        expect(() => Uint8ArraySchema.parse(null)).toThrow();
    });
});
