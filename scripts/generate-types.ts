/**
 * Script to generate TypeScript types with JSDoc from Zod schemas.
 * Uses zod-to-ts to convert schemas and extracts metadata for JSDoc.
 *
 * The .meta({ description: ... }) on schemas automatically becomes JSDoc comments
 * when using zod-to-ts with the metadataRegistry option (defaults to z.globalRegistry).
 *
 * Run: pnpm generate-types
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodTypeAny } from "zod";
import {
    createAuxiliaryTypeStore,
    createTypeAlias,
    printNode,
    zodToTs,
} from "zod-to-ts";

// Import all schemas
import {
    AssetEntitySchema,
    AssetsSettingSchema,
} from "../src/types/v0/Character/Assets";
import {
    CharacterPromptDataSchema,
    CharacterSchema,
} from "../src/types/v0/Character/Character";
import { ChatSchema } from "../src/types/v0/Character/Chat";
import {
    LorebookConditionSchema,
    LorebookDataSchema,
    LorebookEntrySchema,
} from "../src/types/v0/Character/Lorebook";
import { MessageSchema, RoleSchema } from "../src/types/v0/Character/Message";
import { ScriptSettingSchema } from "../src/types/v0/Executables/Executable";
import {
    ReplaceHookEntitySchema,
    ReplaceHookMetaSchema,
    ReplaceHookSchema,
} from "../src/types/v0/Executables/ReplaceHook";
import { PromptSettingsSchema } from "../src/types/v0/Prompt/Prompt";
import { ImageURLSchema, positiveInteger } from "../src/types/v0/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SchemaEntry {
    name: string;
    schema: ZodTypeAny;
    schemaName: string;
}

// Maps output file paths to their schema entries
const fileSchemas: Record<string, SchemaEntry[]> = {
    "v0/Character/Character.d.ts": [
        {
            name: "Character",
            schema: CharacterSchema,
            schemaName: "CharacterSchema",
        },
        {
            name: "CharacterPromptData",
            schema: CharacterPromptDataSchema,
            schemaName: "CharacterPromptDataSchema",
        },
    ],
    "v0/Character/Chat.d.ts": [
        { name: "Chat", schema: ChatSchema, schemaName: "ChatSchema" },
    ],
    "v0/Character/Message.d.ts": [
        { name: "Message", schema: MessageSchema, schemaName: "MessageSchema" },
        { name: "Role", schema: RoleSchema, schemaName: "RoleSchema" },
    ],
    "v0/Character/Lorebook.d.ts": [
        {
            name: "LorebookData",
            schema: LorebookDataSchema,
            schemaName: "LorebookDataSchema",
        },
        {
            name: "LorebookEntry",
            schema: LorebookEntrySchema,
            schemaName: "LorebookEntrySchema",
        },
        {
            name: "LorebookCondition",
            schema: LorebookConditionSchema,
            schemaName: "LorebookConditionSchema",
        },
    ],
    "v0/Character/Assets.d.ts": [
        {
            name: "AssetsSetting",
            schema: AssetsSettingSchema,
            schemaName: "AssetsSettingSchema",
        },
        {
            name: "AssetEntity",
            schema: AssetEntitySchema,
            schemaName: "AssetEntitySchema",
        },
    ],
    "v0/Executables/Executable.d.ts": [
        {
            name: "ScriptSetting",
            schema: ScriptSettingSchema,
            schemaName: "ScriptSettingSchema",
        },
    ],
    "v0/Executables/ReplaceHook.d.ts": [
        {
            name: "ReplaceHook",
            schema: ReplaceHookSchema,
            schemaName: "ReplaceHookSchema",
        },
        {
            name: "ReplaceHookEntity",
            schema: ReplaceHookEntitySchema,
            schemaName: "ReplaceHookEntitySchema",
        },
        {
            name: "ReplaceHookMeta",
            schema: ReplaceHookMetaSchema,
            schemaName: "ReplaceHookMetaSchema",
        },
    ],
    "v0/utils.d.ts": [
        {
            name: "ImageURL",
            schema: ImageURLSchema,
            schemaName: "ImageURLSchema",
        },
        {
            name: "PositiveInteger",
            schema: positiveInteger,
            schemaName: "positiveInteger",
        },
    ],
    "v0/Prompt/Prompt.d.ts": [
        {
            name: "PromptSettings",
            schema: PromptSettingsSchema,
            schemaName: "PromptSettingsSchema",
        },
    ],
};

/**
 * Generates TypeScript type declarations with JSDoc from Zod schemas.
 */
function generateTypesForFile(entries: SchemaEntry[]): string {
    const output: string[] = [
        "// Auto-generated TypeScript types from Zod schemas",
        "// JSDoc comments are extracted from schema .meta({ description }) values",
        'import type { z } from "zod";',
        "",
    ];

    const auxiliaryTypeStore = createAuxiliaryTypeStore();

    for (const { name, schema, schemaName } of entries) {
        // Generate the type
        const { node } = zodToTs(schema, { auxiliaryTypeStore });
        const typeAlias = createTypeAlias(node, name);
        const typeString = printNode(typeAlias);

        output.push(`export ${typeString}`);
        output.push("");

        // Add schema declaration that references the type
        output.push(`export declare const ${schemaName}: z.ZodType<${name}>;`);
        output.push("");
    }

    // Add any auxiliary type definitions
    for (const def of auxiliaryTypeStore.definitions.values()) {
        output.push(`type ${printNode(def.node)}`);
        output.push("");
    }

    return output.join("\n");
}

/**
 * Generate index.d.ts for the main entry point
 */
function generateMainIndex(): string {
    return `// Auto-generated TypeScript types from Zod schemas
import type { z } from "zod";
import type { Character as CharacterV0 } from "./v0/Character/Character";
export { CharacterV0 };
export { CharacterSchema as CharacterV0Schema } from "./v0/Character/Character";

export declare const characterMap: {
    readonly 0: z.ZodType<CharacterV0>;
};

export type CharacterMap = {
    "0": CharacterV0;
};

export default characterMap;
`;
}

/**
 * Generate v0/index.d.ts
 */
function generateV0Index(): string {
    return `// Auto-generated barrel export
export * from "./utils";
`;
}

/**
 * Generate v0.d.ts (barrel for v0/index)
 */
function generateV0Barrel(): string {
    return `// Auto-generated barrel export
export * from "./v0/index";
`;
}

/**
 * Generate v0/Character.d.ts (barrel for Character folder)
 */
function generateCharacterBarrel(): string {
    return `// Auto-generated barrel export
export * from "./Character/Assets";
export * from "./Character/Character";
export * from "./Character/Chat";
export * from "./Character/Lorebook";
export * from "./Character/Message";
`;
}

/**
 * Generate v0/Character/index.d.ts
 */
function generateCharacterIndex(): string {
    return `// Auto-generated barrel export
export * from "./Assets";
export * from "./Character";
export * from "./Chat";
export * from "./Lorebook";
export * from "./Message";
`;
}

/**
 * Generate v0/Executables.d.ts (barrel for Executables folder)
 */
function generateExecutablesBarrel(): string {
    return `// Auto-generated barrel export
export * from "./Executables/Executable";
export * from "./Executables/ReplaceHook";
`;
}

/**
 * Generate v0/Executables/index.d.ts
 */
function generateExecutablesIndex(): string {
    return `// Auto-generated barrel export
export * from "./Executable";
export * from "./ReplaceHook";
`;
}

// Main
const distDir = path.resolve(__dirname, "../dist");

// Generate per-file type declarations
for (const [filePath, entries] of Object.entries(fileSchemas)) {
    const outputPath = path.join(distDir, filePath);
    const content = generateTypesForFile(entries);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, "utf-8");
    console.log(`✅ Generated: ${filePath}`);
}

// Generate main index.d.ts
fs.writeFileSync(
    path.join(distDir, "index.d.ts"),
    generateMainIndex(),
    "utf-8",
);
console.log("✅ Generated: index.d.ts");

// Generate v0/index.d.ts
fs.writeFileSync(
    path.join(distDir, "v0/index.d.ts"),
    generateV0Index(),
    "utf-8",
);
console.log("✅ Generated: v0/index.d.ts");

// Generate v0.d.ts
fs.writeFileSync(path.join(distDir, "v0.d.ts"), generateV0Barrel(), "utf-8");
console.log("✅ Generated: v0.d.ts");

// Generate v0/Character.d.ts
fs.writeFileSync(
    path.join(distDir, "v0/Character.d.ts"),
    generateCharacterBarrel(),
    "utf-8",
);
console.log("✅ Generated: v0/Character.d.ts");

// Generate v0/Character/index.d.ts
fs.writeFileSync(
    path.join(distDir, "v0/Character/index.d.ts"),
    generateCharacterIndex(),
    "utf-8",
);
console.log("✅ Generated: v0/Character/index.d.ts");

// Generate v0/Executables.d.ts
fs.writeFileSync(
    path.join(distDir, "v0/Executables.d.ts"),
    generateExecutablesBarrel(),
    "utf-8",
);
console.log("✅ Generated: v0/Executables.d.ts");

// Generate v0/Executables/index.d.ts
fs.writeFileSync(
    path.join(distDir, "v0/Executables/index.d.ts"),
    generateExecutablesIndex(),
    "utf-8",
);
console.log("✅ Generated: v0/Executables/index.d.ts");

console.log("\n🎉 All type declarations generated successfully!");
