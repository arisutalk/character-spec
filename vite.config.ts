import { defineConfig } from "vite";

export default defineConfig({
    plugins: [],
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"],
        },
        sourcemap: true,
    },
    clearScreen: false,
});
