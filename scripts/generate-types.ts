/**
 * Generate .d.ts files from Zod schemas with JSDoc extracted from schema metadata.
 *
 * This script is ERROR-INTOLERANT: it will fail loudly on any unexpected condition.
 *
 * Features:
 * - Scans src/types directory recursively (excluding index.ts)
 * - Any export ending with "Schema" MUST be a Zod schema (else: throw)
 * - Generates type aliases + JSDoc comments from .meta() / .describe()
 * - Mirrors directory structure into dist/
 * - Supports z.instanceof(Uint8Array) and other custom schemas via meta.tsType
 * - Property-level JSDoc comments are preserved
 *
 * Run: pnpm generate-types
 */
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { glob } from "tinyglobby";
import ts from "typescript";
import { ZodType, z } from "zod";
import {
    createAuxiliaryTypeStore,
    createTypeAlias,
    printNode,
    type TypeOverrideMap,
    zodToTs,
} from "zod-to-ts";
import tsconfig from "../tsconfig.base.json";

// =============================================================================
// Configuration
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, "../src/types");
const DIST_DIR = path.resolve(__dirname, "../dist");

const SCHEMA_EXPORT_SUFFIX = "Schema";
const IGNORE_GLOBS = Object.freeze([
    "**/index.ts",
    "**/*.test.ts",
    "**/*.spec.ts",
]);

const RESERVED_TYPE_NAMES = Object.freeze([
    "Uint8Array",
    "File",
    "Blob",
    "ArrayBuffer",
    "Date",
    "Map",
    "Set",
    "Promise",
    "Error",
] as const);

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Assertion function that throws a descriptive error if condition is false.
 * This is the foundation of error-intolerant behavior.
 */
function invariant(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

class TypeGenerationError extends Error {
    constructor(
        message: string,
        public readonly filePath: string,
        public readonly cause?: unknown,
    ) {
        super(`[${filePath}] ${message}`);
        this.name = "TypeGenerationError";
    }
}

class SchemaExtractionError extends Error {
    constructor(
        message: string,
        public readonly schemaName: string,
        public readonly cause?: unknown,
    ) {
        super(`[Schema: ${schemaName}] ${message}`);
        this.name = "SchemaExtractionError";
    }
}

// =============================================================================
// Types
// =============================================================================

interface SchemaEntry {
    /** Type name (e.g., "Character") */
    readonly typeName: string;
    /** Original export name (e.g., "CharacterSchema") */
    readonly exportName: string;
    /** Zod schema instance */
    readonly schema: z.ZodTypeAny;
}

interface ZodDefWithMeta {
    readonly type?: string;
    readonly fn?: unknown;
    readonly format?: string;
    readonly innerType?: ZodType;
    readonly schema?: ZodType;
    readonly left?: ZodType;
    readonly right?: ZodType;
    readonly options?: readonly unknown[];
    readonly shape?: (() => Record<string, unknown>) | Record<string, unknown>;
    readonly element?: ZodType;
    readonly items?: readonly unknown[];
    readonly valueType?: ZodType;
    readonly keyType?: ZodType;
    readonly cls?: new (...args: unknown[]) => unknown;
    readonly checks?: readonly unknown[];
}

interface SchemaMeta {
    readonly description?: unknown;
    readonly deprecated?: unknown;
    readonly since?: unknown;
    readonly example?: unknown;
    readonly examples?: unknown;
    readonly default?: unknown;
    readonly see?: unknown;
    readonly tsType?: unknown;
}

// =============================================================================
// Utility Functions
// =============================================================================

function toPosix(p: string): string {
    return p.replaceAll("\\", "/");
}

function fsPathFromPosixRelative(root: string, posixRel: string): string {
    const parts = posixRel.split("/").filter(Boolean);
    return path.join(root, ...parts);
}

function ensureValidTsIdentifier(name: string, context: string): void {
    invariant(
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name),
        `Invalid TypeScript identifier "${name}" (${context}). ` +
            `Rename the export or adjust deriveTypeName().`,
    );
}

function isZodType(value: unknown): value is ZodType {
    return value instanceof ZodType;
}

function getZodDef(schema: ZodType): ZodDefWithMeta | undefined {
    return schema.def as ZodDefWithMeta | undefined;
}

/**
 * Derives type name from schema export name.
 * @example "CharacterSchema" -> "Character"
 * @example "positiveIntegerSchema" -> "PositiveInteger"
 */
function deriveTypeName(schemaExportName: string): string {
    invariant(
        schemaExportName.length > 0,
        "deriveTypeName() received an empty export name.",
    );

    let base = schemaExportName.endsWith(SCHEMA_EXPORT_SUFFIX)
        ? schemaExportName.slice(0, -SCHEMA_EXPORT_SUFFIX.length)
        : schemaExportName;

    invariant(
        base.length > 0,
        `Export "${schemaExportName}" becomes empty after removing "${SCHEMA_EXPORT_SUFFIX}".`,
    );

    // Uppercase first letter
    base = base.charAt(0).toUpperCase() + base.slice(1);

    // Avoid conflicts with global types
    if (
        RESERVED_TYPE_NAMES.includes(
            base as (typeof RESERVED_TYPE_NAMES)[number],
        )
    ) {
        return `${base}Type`;
    }

    ensureValidTsIdentifier(base, `derived from export "${schemaExportName}"`);
    return base;
}

// =============================================================================
// Schema Metadata Extraction
// =============================================================================

/**
 * Reads metadata from a Zod schema (supports multiple Zod versions).
 */
function readSchemaMeta(schema: z.ZodTypeAny): SchemaMeta {
    // Zod v4: Try calling .meta() method first
    if ("meta" in schema && typeof schema.meta === "function") {
        try {
            // In Zod v4, schema.meta() returns the stored meta when called without args
            const metaResult = (schema as { meta: () => unknown }).meta();
            if (metaResult && typeof metaResult === "object") {
                return metaResult satisfies SchemaMeta;
            }
        } catch {
            // meta() might throw or return the schema itself with args
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: Need to try various locations where Zod stores metadata
    const def: any = schema.def;

    // Try various locations where Zod stores metadata
    const meta: SchemaMeta | undefined =
        ("meta" in schema.def ? schema.def.meta : undefined) ??
        ("metadata" in schema.def ? schema.def.metadata : undefined) ??
        def.params?.meta ??
        def.openapi?.meta ??
        undefined;

    const description =
        meta?.description ??
        ("description" in schema.def
            ? schema.def.description
            : schema.description);

    return {
        ...(typeof meta === "object" && meta !== null ? meta : {}),
        description,
    };
}

function escapeForJsDoc(text: string): string {
    return text.replaceAll("*/", "*\\/");
}

/**
 * Builds a JSDoc comment block from schema metadata.
 */
function buildJsDoc(schema: z.ZodTypeAny): string {
    const meta = readSchemaMeta(schema);
    const lines: string[] = [];

    // Description
    const description =
        typeof meta.description === "string" ? meta.description.trim() : "";

    if (description) {
        lines.push(...description.split("\n").map((l) => l.trimEnd()));
    }

    // Common JSDoc tags
    if (meta.deprecated === true) lines.push("@deprecated");
    if (typeof meta.deprecated === "string" && meta.deprecated.trim()) {
        lines.push(`@deprecated ${meta.deprecated.trim()}`);
    }

    if (typeof meta.since === "string" && meta.since.trim()) {
        lines.push(`@since ${meta.since.trim()}`);
    }

    if (typeof meta.default === "string" && meta.default.trim()) {
        lines.push(`@default ${meta.default.trim()}`);
    }

    if (typeof meta.see === "string" && meta.see.trim()) {
        lines.push(`@see ${meta.see.trim()}`);
    }

    if (typeof meta.example === "string" && meta.example.trim()) {
        lines.push(`@example ${meta.example.trim()}`);
    }

    if (Array.isArray(meta.examples)) {
        for (const ex of meta.examples) {
            if (typeof ex === "string" && ex.trim()) {
                lines.push(`@example ${ex.trim()}`);
            }
        }
    }

    if (lines.length === 0) return "";

    const body = lines.map((l) => ` * ${escapeForJsDoc(l)}`).join("\n");
    return `/**\n${body}\n */\n`;
}

// =============================================================================
// Custom Schema Detection & Type Override
// =============================================================================

function parseTypeNodeFromString(
    typeText: string,
    context: string,
): ts.TypeNode {
    const source = ts.createSourceFile(
        "inline-type.ts",
        `type __T = ${typeText};`,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );

    const stmt = source.statements[0];
    invariant(
        stmt && ts.isTypeAliasDeclaration(stmt),
        `Failed to parse meta.tsType "${typeText}" (${context}). ` +
            `Make sure it is a valid TypeScript type expression.`,
    );
    return stmt.type;
}

function isProbablyZodCustom(schema: z.ZodTypeAny): boolean {
    const def = schema.def;
    return schema instanceof z.ZodCustom || def.type === "custom";
}

function getCustomPredicate(
    schema: z.ZodTypeAny,
): ((v: unknown) => unknown) | null {
    // biome-ignore lint/suspicious/noExplicitAny: Need to try various locations where Zod stores metadata
    const def: any = schema.def;
    const candidate = def?.fn ?? def?.check ?? def?.predicate ?? null;
    return typeof candidate === "function" ? candidate : null;
}

function sampleValueForCtor(ctor: unknown): unknown | null {
    if (ctor === Uint8Array) return new Uint8Array();
    if (ctor === ArrayBuffer) return new ArrayBuffer(0);
    if (ctor === Date) return new Date(0);
    return null;
}

function matchesInstanceofViaDefChecks(
    schema: z.ZodTypeAny,
    ctor: unknown,
): boolean {
    const def = getZodDef(schema);
    const checks = def?.checks;
    if (!Array.isArray(checks)) return false;

    for (const check of checks) {
        const kind = check?.kind ?? check?.type ?? check?.check;
        const cls =
            check?.cls ?? check?.class ?? check?.ctor ?? check?.instanceof;
        if (kind === "instanceof" && cls === ctor) return true;
    }
    return false;
}

/**
 * Attempts to detect z.instanceof by checking cls property or fn behavior.
 * Returns the constructor if detected, null otherwise.
 */
function detectInstanceofClass(schema: z.ZodTypeAny): unknown | null {
    const def = getZodDef(schema);
    if (!def) return null;

    // Check cls property (Zod v4 may store class reference here)
    const cls = def.cls;
    if (cls && typeof cls === "function") {
        return cls;
    }

    // Check predicate function for instanceof check
    const pred = getCustomPredicate(schema);
    if (!pred) return null;

    // Test known constructors
    const knownCtors = [Uint8Array, ArrayBuffer, Date];
    for (const ctor of knownCtors) {
        const sample = sampleValueForCtor(ctor);
        if (sample === null) continue;

        try {
            if (pred(sample) === true && !pred({}) && !pred(null)) {
                return ctor;
            }
        } catch {
            // Ignore
        }
    }

    // Check fn.toString() as last resort
    const fn = def.fn;
    if (typeof fn === "function") {
        const fnStr = fn.toString();
        for (const ctor of knownCtors) {
            if (fnStr.includes(ctor.name) || fnStr.includes("instanceof")) {
                return ctor;
            }
        }
    }

    return null;
}

/**
 * Attempts to detect known custom schemas and returns a TypeNode override.
 * - If schema has `.meta({ tsType: "..." })`, that always wins.
 * - Otherwise, tries to identify known safe types (Uint8Array, ArrayBuffer).
 * - Returns null if unknown (caller should throw for error-intolerant behavior).
 */
function getCustomOverrideTypeNode(
    schema: z.ZodTypeAny,
    context: string,
): ts.TypeNode | null {
    const meta = readSchemaMeta(schema);

    // Explicit tsType always wins
    if (typeof meta.tsType === "string" && meta.tsType.trim()) {
        return parseTypeNodeFromString(meta.tsType.trim(), context);
    }

    // Check via internal checks array
    if (matchesInstanceofViaDefChecks(schema, Uint8Array)) {
        return ts.factory.createTypeReferenceNode("Uint8Array", undefined);
    }
    if (matchesInstanceofViaDefChecks(schema, ArrayBuffer)) {
        return ts.factory.createTypeReferenceNode("ArrayBuffer", undefined);
    }

    // Try detecting instanceof class
    const detectedClass = detectInstanceofClass(schema);
    if (detectedClass === Uint8Array) {
        return ts.factory.createTypeReferenceNode("Uint8Array", undefined);
    }
    if (detectedClass === ArrayBuffer) {
        return ts.factory.createTypeReferenceNode("ArrayBuffer", undefined);
    }
    if (detectedClass === Date) {
        return ts.factory.createTypeReferenceNode("Date", undefined);
    }

    // Fallback: probe predicate behavior
    const pred = getCustomPredicate(schema);
    if (pred) {
        const candidates: Array<{ ctor: unknown; tsName: string }> = [
            { ctor: Uint8Array, tsName: "Uint8Array" },
            { ctor: ArrayBuffer, tsName: "ArrayBuffer" },
        ];

        for (const c of candidates) {
            const sample = sampleValueForCtor(c.ctor);
            if (sample === null) continue;

            let okSample = false;
            let okRejects = false;

            try {
                okSample = Boolean(pred(sample));
            } catch {
                okSample = false;
            }

            try {
                okRejects = !pred({}) && !pred(null) && !pred("not-a-match");
            } catch {
                okRejects = false;
            }

            if (okSample && okRejects) {
                return ts.factory.createTypeReferenceNode(c.tsName, undefined);
            }
        }
    }

    return null;
}

// =============================================================================
// Format-based Schema Handling (z.url(), z.int(), etc.)
// =============================================================================

function getFormatBasedType(schema: ZodType): ts.TypeNode | null {
    const def = getZodDef(schema);
    if (!def?.format) return null;

    // String-based formats
    if (schema instanceof z.ZodString) {
        const stringFormats = [
            "url",
            "email",
            "uuid",
            "cuid",
            "cuid2",
            "ulid",
            "datetime",
            "date",
            "time",
            "duration",
            "ip",
            "cidr",
            "base64",
            "base64url",
            "nanoid",
            "jwt",
        ];
        if (stringFormats.includes(def.format)) {
            return ts.factory.createKeywordTypeNode(
                ts.SyntaxKind.StringKeyword,
            );
        }
    }

    // Number-based formats
    if (schema instanceof z.ZodNumber) {
        const numberFormats = [
            "safeint",
            "int32",
            "uint32",
            "float32",
            "float64",
        ];
        if (numberFormats.includes(def.format)) {
            return ts.factory.createKeywordTypeNode(
                ts.SyntaxKind.NumberKeyword,
            );
        }
    }

    return null;
}

// =============================================================================
// Schema Graph Traversal
// =============================================================================

/**
 * Collects all Zod schemas from module exports (including nested).
 */
function collectAllSchemasFromModuleExports(
    moduleExports: Record<string, unknown>,
): Set<z.ZodTypeAny> {
    const found = new Set<z.ZodTypeAny>();
    const visitedObjects = new WeakSet<object>();

    const walk = (value: unknown): void => {
        if (value instanceof ZodType) {
            const schema = value satisfies z.ZodType;
            if (found.has(schema)) return;
            found.add(schema);

            const def = schema?.def;
            if (def && typeof def === "object") walk(def);

            // Handle ZodObject shape
            try {
                // biome-ignore lint/suspicious/noExplicitAny: If it's not ZodObject, shape will be undefined so its ok
                const shape = (def as any)?.shape;
                if (typeof shape === "function" && shape.length === 0) {
                    const s = shape();
                    if (s && typeof s === "object") walk(s);
                } else if (shape && typeof shape === "object") {
                    walk(shape);
                }
            } catch {
                // Shape access failed, continue
            }

            return;
        }

        if (Array.isArray(value)) {
            for (const v of value) walk(v);
            return;
        }

        if (value && typeof value === "object") {
            if (visitedObjects.has(value as object)) return;
            visitedObjects.add(value as object);

            for (const v of Object.values(value as Record<string, unknown>)) {
                if (typeof v === "function") continue;
                walk(v);
            }
        }
    };

    for (const v of Object.values(moduleExports)) walk(v);
    return found;
}

/**
 * Builds TypeOverrideMap for all special schemas.
 * Throws error for unknown custom schemas (error-intolerant behavior).
 */
function buildOverridesOrThrow(
    allSchemas: Set<z.ZodTypeAny>,
    context: string,
): TypeOverrideMap {
    const overrides: TypeOverrideMap = new Map();

    for (const schema of allSchemas) {
        // Skip if already overridden
        if (overrides.has(schema)) continue;

        // Handle format-based schemas (z.url(), z.int(), etc.)
        const formatType = getFormatBasedType(schema);
        if (formatType) {
            overrides.set(schema, () => formatType);
            continue;
        }

        // Handle custom schemas
        if (isProbablyZodCustom(schema)) {
            const override = getCustomOverrideTypeNode(schema, context);
            if (override) {
                overrides.set(schema, () => override);
                continue;
            }

            // Check if this is a validation-only custom (refinement check)
            // Refinement checks don't define types, they just validate
            const pred = getCustomPredicate(schema);
            if (pred) {
                const fnStr = pred.toString();
                // Heuristics for refinement checks (validation-only):
                // - Contains comparison operators (===, !==, <, >, <=, >=)
                // - Contains .size, .length checks (common in uniqueness validators)
                // - Doesn't contain instanceof (which would indicate type check)
                const isLikelyRefinement =
                    !fnStr.includes("instanceof") &&
                    (fnStr.includes("===") ||
                        fnStr.includes("!==") ||
                        fnStr.includes(".size") ||
                        fnStr.includes(".length"));

                if (isLikelyRefinement) {
                    // Skip refinement checks - they don't affect the type
                    continue;
                }
            }

            // Error-intolerant: fail on unknown custom schema that affects types
            const meta = readSchemaMeta(schema);
            throw new Error(
                `Unsupported Zod custom schema encountered (${context}). ` +
                    `This script requires either:\n` +
                    `- a known safe type (e.g. z.instanceof(Uint8Array)), or\n` +
                    `- an explicit override via .meta({ tsType: "..." }).\n` +
                    `Current meta.tsType: ${typeof meta.tsType === "string" ? JSON.stringify(meta.tsType) : String(meta.tsType)}\n` +
                    `Fix: add .meta({ tsType: "Uint8Array" }) (or the appropriate TS type).`,
            );
        }
    }

    return overrides;
}

// =============================================================================
// Schema Extraction
// =============================================================================

/**
 * Extracts schema entries from module exports.
 * Throws error if an export ending with "Schema" is not a Zod schema.
 */
function extractSchemasOrThrow(
    moduleExports: Record<string, unknown>,
    fileContext: string,
): SchemaEntry[] {
    const entries: SchemaEntry[] = [];

    for (const [exportName, value] of Object.entries(moduleExports)) {
        if (!exportName.endsWith(SCHEMA_EXPORT_SUFFIX)) continue;

        invariant(
            value instanceof ZodType,
            `In ${fileContext}: export "${exportName}" ends with "${SCHEMA_EXPORT_SUFFIX}" ` +
                `but is not a Zod schema. Fix the export or rename it.`,
        );

        const typeName = deriveTypeName(exportName);

        entries.push({
            typeName,
            exportName,
            schema: value as z.ZodTypeAny,
        });
    }

    // Deterministic order
    entries.sort((a, b) => a.exportName.localeCompare(b.exportName));

    // Check for duplicate type names
    const seen = new Set<string>();
    for (const e of entries) {
        invariant(
            !seen.has(e.typeName),
            `In ${fileContext}: duplicate derived type name "${e.typeName}". ` +
                `Rename schema exports to avoid collisions.`,
        );
        seen.add(e.typeName);
    }

    return entries;
}

// =============================================================================
// Property JSDoc Extraction
// =============================================================================

/**
 * Extracts JSDoc descriptions for object properties.
 */
function extractPropertyDocs(schema: ZodType): ReadonlyMap<string, string> {
    const docs = new Map<string, string>();
    const def = getZodDef(schema);
    if (!def?.shape) return docs;

    const shape = typeof def.shape === "function" ? def.shape() : def.shape;

    for (const [key, fieldSchema] of Object.entries(shape)) {
        if (!isZodType(fieldSchema)) continue;

        const meta = readSchemaMeta(fieldSchema as z.ZodTypeAny);
        if (typeof meta.description === "string" && meta.description.trim()) {
            docs.set(key, meta.description.trim());
        }
    }

    return docs;
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Adds JSDoc comments to TypeScript type properties.
 * Only adds if the property doesn't already have a JSDoc comment.
 */
function addPropertyJsDocs(
    typeString: string,
    propertyDocs: ReadonlyMap<string, string>,
): string {
    if (propertyDocs.size === 0) return typeString;

    let result = typeString;

    for (const [propName, description] of propertyDocs) {
        // Match property that is NOT preceded by a JSDoc comment
        // This regex looks for property declarations that don't have /** ... */ right before them
        const propRegex = new RegExp(
            `(\\n)(\\s*)(${escapeRegExp(propName)}\\??\\s*:)`,
            "g",
        );

        const jsDoc = `/** ${escapeForJsDoc(description)} */`;

        // Replace only if no JSDoc already exists before the property
        result = result.replace(propRegex, (match, newline, indent, prop) => {
            // Check if the previous line already contains a JSDoc
            const currentIndex = result.lastIndexOf(match);
            const beforeMatch = result.substring(0, currentIndex);
            const lastNewline = beforeMatch.lastIndexOf("\n");
            const prevLine = beforeMatch.substring(lastNewline + 1);

            // If previous line ends with */ it already has JSDoc
            if (prevLine.trim().endsWith("*/")) {
                return match; // Don't add duplicate
            }

            return `${newline}${indent}${jsDoc}${newline}${indent}${prop}`;
        });
    }

    return result;
}

// =============================================================================
// Type Generation
// =============================================================================

/**
 * Generates TypeScript declarations for a module.
 */
function generateTypesForModule(
    entries: SchemaEntry[],
    overrides: TypeOverrideMap,
): string {
    const out: string[] = [
        "// Auto-generated TypeScript declarations from Zod schemas. DO NOT EDIT.",
        "// Regenerate with: pnpm generate-types",
        "",
        'import type { ZodType } from "zod";',
        "",
    ];

    const auxiliaryTypeStore = createAuxiliaryTypeStore();

    for (const { typeName, exportName, schema } of entries) {
        const jsdoc = buildJsDoc(schema);

        // Generate the type alias
        const { node } = zodToTs(schema, { auxiliaryTypeStore, overrides });
        const typeAliasDecl = createTypeAlias(node, typeName);
        let typeString = printNode(typeAliasDecl);

        // Add property-level JSDoc comments
        const propertyDocs = extractPropertyDocs(schema);
        typeString = addPropertyJsDocs(typeString, propertyDocs);

        // Export the type with JSDoc
        if (jsdoc) out.push(jsdoc.trimEnd());
        out.push(`export ${typeString}`);
        out.push("");

        // Declare the schema const with JSDoc
        if (jsdoc) out.push(jsdoc.trimEnd());
        out.push(`export declare const ${exportName}: ZodType<${typeName}>;`);
        out.push("");
    }

    // Emit auxiliary type definitions (deterministic order)
    const aux = [...auxiliaryTypeStore.definitions.entries()].sort((a, b) =>
        String(a[0]).localeCompare(String(b[0])),
    );

    for (const [, def] of aux) {
        const defStr = printNode(def.node).trim();
        invariant(
            defStr.startsWith("type ") || defStr.startsWith("interface "),
            `Unexpected auxiliary definition emitted by zod-to-ts: "${defStr}"`,
        );
        out.push(defStr);
        out.push("");
    }

    return `${out.join("\n").trimEnd()}\n`;
}

// =============================================================================
// Barrel Export Generation
// =============================================================================

function generateDirectoryIndexDts(
    dirModules: string[],
    dirSubdirs: string[],
): string {
    const lines: string[] = ["// Auto-generated barrel export. DO NOT EDIT."];

    for (const mod of dirModules) {
        lines.push(`export * from "./${mod}";`);
    }
    for (const sub of dirSubdirs) {
        lines.push(`export * from "./${sub}/index";`);
    }

    return `${lines.join("\n")}\n`;
}

function generateParentBarrelDts(folderName: string): string {
    return `// Auto-generated barrel export. DO NOT EDIT.
export * from "./${folderName}/index";
`;
}

/**
 * Generates main index.d.ts with character version exports.
 */
function generateMainIndexDts(
    characterVersions: Array<{ version: number; versionDir: string }>,
): string {
    const lines: string[] = [
        "// Auto-generated entry declarations. DO NOT EDIT.",
        'import type { ZodType } from "zod";',
    ];

    if (characterVersions.length === 0) {
        lines.push("");
        lines.push("// No CharacterSchema exports found.");
        lines.push("export {};");
        return `${lines.join("\n")}\n`;
    }

    // Imports and re-exports
    for (const v of characterVersions) {
        const vTag = `V${v.version}`;
        const rel = `./${v.versionDir}/Character/Character`;
        lines.push(
            `import type { Character as Character${vTag} } from ${JSON.stringify(rel)};`,
        );
        lines.push(`export { Character${vTag} };`);
        lines.push(
            `export { CharacterSchema as Character${vTag}Schema } from ${JSON.stringify(rel)};`,
        );
        lines.push("");
    }

    // characterMap declaration
    lines.push("export declare const characterMap: {");
    for (const v of characterVersions) {
        const vTag = `V${v.version}`;
        lines.push(`  readonly ${v.version}: ZodType<Character${vTag}>;`);
    }
    lines.push("};");
    lines.push("");

    // CharacterMap type
    lines.push("export type CharacterMap = {");
    for (const v of characterVersions) {
        const vTag = `V${v.version}`;
        lines.push(
            `  readonly ${JSON.stringify(String(v.version))}: Character${vTag};`,
        );
    }
    lines.push("};");
    lines.push("");

    lines.push("export default characterMap;");
    lines.push("");

    return lines.join("\n");
}

// =============================================================================
// Main Process
// =============================================================================

async function main(): Promise<void> {
    console.log("🔍 Scanning source files...\n");

    invariant(
        existsSync(SRC_DIR),
        `Source directory does not exist: ${SRC_DIR}`,
    );

    const sourceFiles = await glob("**/*.ts", {
        cwd: SRC_DIR,
        ignore: [...IGNORE_GLOBS],
        absolute: false,
    });

    invariant(sourceFiles.length > 0, `No source files found in ${SRC_DIR}`);

    console.log(`📁 Found ${sourceFiles.length} source file(s)\n`);

    // Directory graph for barrel exports
    const dirModules = new Map<string, Set<string>>();
    const dirSubdirs = new Map<string, Set<string>>();

    const ensureDirEntry = (dir: string) => {
        if (!dirModules.has(dir)) dirModules.set(dir, new Set());
        if (!dirSubdirs.has(dir)) dirSubdirs.set(dir, new Set());
    };

    const addDirEdge = (parent: string, childName: string) => {
        ensureDirEntry(parent);
        if (!dirSubdirs.get(parent)?.add(childName)) {
            throw new Error(`No such directory: ${parent}`);
        }
    };

    // Character version collection
    const characterVersions: Array<{ version: number; versionDir: string }> =
        [];

    // Generated module paths for summary
    const generatedModules: string[] = [];

    // Deterministic order
    sourceFiles.sort((a, b) => a.localeCompare(b));

    for (const relFs of sourceFiles) {
        const relPosix = toPosix(relFs);
        const srcPath = path.join(SRC_DIR, relFs);

        const modulePosixPath = relPosix.replace(/\.ts$/, "");
        const outPosixPath = `${modulePosixPath}.d.ts`;
        const outFsPath = fsPathFromPosixRelative(DIST_DIR, outPosixPath);

        // Dynamic import the module
        let moduleUrl = pathToFileURL(srcPath).href;
        // Resolve path of tsconfig's
        const tscPath = Object.entries(tsconfig.compilerOptions.paths);
        tscPath.forEach(([key, value]) => {
            if (moduleUrl.startsWith(key.replace("*", ""))) {
                console.log(`Resolving paths: ${moduleUrl} -> ${value[0]}`);
                moduleUrl = moduleUrl.replace(
                    key.replace("*", ""),
                    value[0].replace("*", ""),
                );
            }
        });
        console.log(`Resolved: ${moduleUrl}`);

        let moduleExports: Record<string, unknown>;
        try {
            moduleExports = (await import(moduleUrl)) as Record<
                string,
                unknown
            >;
        } catch (e) {
            throw new TypeGenerationError(
                `Failed to import module`,
                srcPath,
                e,
            );
        }

        const fileContext = relPosix;
        const entries = extractSchemasOrThrow(moduleExports, fileContext);

        if (entries.length === 0) {
            console.log(`⏭️  Skipped (no schemas): ${relPosix}`);
            continue;
        }

        const allSchemas = collectAllSchemasFromModuleExports(moduleExports);
        const overrides = buildOverridesOrThrow(
            allSchemas,
            `module ${fileContext}`,
        );

        let content: string;
        try {
            content = generateTypesForModule(entries, overrides);
        } catch (e) {
            throw new TypeGenerationError(
                `Failed to generate declarations`,
                srcPath,
                e,
            );
        }

        await fs.mkdir(path.dirname(outFsPath), { recursive: true });
        await fs.writeFile(outFsPath, content, "utf8");

        console.log(
            `✅ Generated: ${outPosixPath} (${entries.length} type(s))`,
        );
        generatedModules.push(modulePosixPath);

        // Build directory graph
        const dir = path.posix.dirname(modulePosixPath);
        const base = path.posix.basename(modulePosixPath);

        ensureDirEntry(dir);
        if (!dirModules.get(dir)?.add(base)) {
            throw new Error(`No such directory: ${dir}`);
        }

        // Parent directory relationship
        if (dir !== ".") {
            const parent = path.posix.dirname(dir);
            const childName = path.posix.basename(dir);
            addDirEdge(parent, childName);
        }

        // Detect character versions
        if (
            modulePosixPath.match(/^v\d+\/Character\/Character$/) &&
            entries.some((e) => e.exportName === "CharacterSchema")
        ) {
            const vDir = modulePosixPath.split("/")[0];
            const m = /^v(\d+)$/.exec(vDir);
            if (m) {
                characterVersions.push({
                    version: Number(m[1]),
                    versionDir: vDir,
                });
            }
        }
    }

    console.log("");

    // Generate index.d.ts for each directory
    const allDirs = new Set<string>([
        ...dirModules.keys(),
        ...dirSubdirs.keys(),
    ]);
    const sortedDirs = [...allDirs].sort((a, b) => a.localeCompare(b));

    for (const dir of sortedDirs) {
        ensureDirEntry(dir);

        // biome-ignore lint/style/noNonNullAssertion: All exists, since sortedDirs is just a sorted version of allDirs
        const modules = [...dirModules.get(dir)!].sort((a, b) =>
            a.localeCompare(b),
        );
        // biome-ignore lint/style/noNonNullAssertion: Same as modules'
        const subs = [...dirSubdirs.get(dir)!].sort((a, b) =>
            a.localeCompare(b),
        );

        if (modules.length === 0 && subs.length === 0) continue;

        const indexPosix = path.posix.join(dir, "index.d.ts");
        const indexFs = fsPathFromPosixRelative(DIST_DIR, indexPosix);

        await fs.mkdir(path.dirname(indexFs), { recursive: true });
        await fs.writeFile(
            indexFs,
            generateDirectoryIndexDts(modules, subs),
            "utf8",
        );

        console.log(`📦 Generated barrel: ${indexPosix}`);

        // Parent-level barrel
        if (dir !== ".") {
            const parent = path.posix.dirname(dir);
            const folderName = path.posix.basename(dir);

            const parentBarrelPosix = path.posix.join(
                parent,
                `${folderName}.d.ts`,
            );
            const parentBarrelFs = fsPathFromPosixRelative(
                DIST_DIR,
                parentBarrelPosix,
            );

            await fs.mkdir(path.dirname(parentBarrelFs), { recursive: true });
            await fs.writeFile(
                parentBarrelFs,
                generateParentBarrelDts(folderName),
                "utf8",
            );

            console.log(`📦 Generated barrel: ${parentBarrelPosix}`);
        }
    }

    // Deduplicate and sort character versions
    const uniqueCharacterVersions = new Map<number, string>();
    for (const v of characterVersions) {
        uniqueCharacterVersions.set(v.version, v.versionDir);
    }

    const normalizedCharacterVersions = [...uniqueCharacterVersions.entries()]
        .map(([version, versionDir]) => ({ version, versionDir }))
        .sort((a, b) => a.version - b.version);

    // Main index.d.ts
    await fs.mkdir(DIST_DIR, { recursive: true });
    await fs.writeFile(
        path.join(DIST_DIR, "index.d.ts"),
        generateMainIndexDts(normalizedCharacterVersions),
        "utf8",
    );
    console.log("📦 Generated: index.d.ts");

    // Version barrel files (v0.d.ts, v1.d.ts, ...)
    const versionDirs = sortedDirs
        .filter((d) => /^v\d+$/.test(d))
        .sort((a, b) => a.localeCompare(b));

    for (const vDir of versionDirs) {
        const vBarrelFs = path.join(DIST_DIR, `${vDir}.d.ts`);
        await fs.writeFile(
            vBarrelFs,
            `// Auto-generated barrel export. DO NOT EDIT.\nexport * from "./${vDir}/index";\n`,
            "utf8",
        );
        console.log(`📦 Generated: ${vDir}.d.ts`);
    }

    // Summary
    console.log(`\n${"=".repeat(50)}`);
    console.log("🎉 Type generation complete!");
    console.log(`   ✅ Generated: ${generatedModules.length} module(s)`);
    console.log("=".repeat(50));
}

// =============================================================================
// Entry Point
// =============================================================================

try {
    await main();
} catch (error) {
    console.error("\n❌ Type generation failed!\n");

    if (error instanceof TypeGenerationError) {
        console.error(`File: ${error.filePath}`);
        console.error(`Error: ${error.message}`);
        if (error.cause instanceof Error) {
            console.error(`Cause: ${error.cause.message}`);
        }
    } else if (error instanceof SchemaExtractionError) {
        console.error(`Schema: ${error.schemaName}`);
        console.error(`Error: ${error.message}`);
        if (error.cause instanceof Error) {
            console.error(`Cause: ${error.cause.message}`);
        }
    } else if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        if (error.stack) {
            console.error(`\nStack trace:\n${error.stack}`);
        }
    } else {
        console.error("Unknown error:", error);
    }

    process.exit(1);
}
