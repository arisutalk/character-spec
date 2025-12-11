import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [
        tsconfigPaths({}),
        dts({
            rollupTypes: true,
            insertTypesEntry: true,
        }),
    ],
    build: {
        lib: {
            entry: {
                index: "src/index.ts",
                v0: "src/types/v0/index.ts",
            },
            fileName: (_, entryName) => `${entryName}.js`,

            formats: ["es"],
        },
        sourcemap: true,
        rollupOptions: {
            external: ["valibot"],
        },
    },
    clearScreen: false,
});
