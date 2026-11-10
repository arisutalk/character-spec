/**
 * Generate the published .d.ts files from the Zod schemas, with JSDoc taken from
 * the schemas' `.meta({ description })`.
 *
 * Inputs:
 * - the schema modules in `src/types` (imported at runtime, via tsx)
 * - the intermediate declarations emitted by `vite build` (vite-plugin-dts) in
 *   `node_modules/.cache/character-spec-dts`. They carry the precise Zod types
 *   of every export, and mirror the barrel (`index.ts`) structure of `src`.
 *
 * Output (`dist`):
 * - one .d.ts per schema module: JSDoc-rich plain types (zod-to-ts), the schema
 *   declarations, and every other export of the module
 * - the barrel of each spec version (`v0.d.ts` for `src/types/v0/index.ts`),
 *   which re-exports the schema modules directly with `.js` extensions, so it
 *   resolves under every `moduleResolution`. The barrels of the folders are not
 *   emitted: nobody can import them, and they have no runtime counterpart.
 * - `index.d.ts` (entry point) and the top-level modules such as `utils.d.ts`
 *
 * This script is ERROR-INTOLERANT: it will fail loudly on any unexpected condition.
 * Any export ending with "Schema" MUST be a Zod schema, and every runtime export
 * MUST end up declared.
 *
 * Run (after `vite build`): pnpm generate-types
 */
import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { glob } from "tinyglobby";
import ts from "typescript";
import * as z from "zod";
import {
    createAuxiliaryTypeStore,
    createTypeAlias,
    printNode,
    type TypeOverrideMap,
    zodToTs,
} from "zod-to-ts";

// =============================================================================
// Configuration
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src/types");
const DIST_DIR = path.join(ROOT_DIR, "dist");
/** Must match `DTS_CACHE_DIR` of vite.config.ts. */
const DTS_CACHE_DIR = path.join(
    ROOT_DIR,
    "node_modules/.cache/character-spec-dts",
);
/** Directory of `SRC_DIR` inside the declaration cache (see `entryRoot` of vite.config.ts). */
const DTS_CACHE_TYPES_DIR = path.join(DTS_CACHE_DIR, "types");

const SCHEMA_EXPORT_SUFFIX = "Schema";
const IGNORE_GLOBS = Object.freeze([
    "**/index.ts",
    "**/*.test.ts",
    "**/*.spec.ts",
]);

const RESERVED_TYPE_NAMES: readonly string[] = Object.freeze([
    "Uint8Array",
    "File",
    "Blob",
    "ArrayBuffer",
    "Date",
    "Map",
    "Set",
    "Promise",
    "Error",
]);

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

// =============================================================================
// Types
// =============================================================================

interface SchemaEntry {
    /** Type name (e.g., "Character") */
    readonly typeName: string;
    /** Original export name (e.g., "CharacterSchema") */
    readonly exportName: string;
    /** Zod schema instance */
    readonly schema: z.ZodType;
}

/** Any constructor, used to recognise `z.instanceof(...)` schemas. */
type AnyConstructor = abstract new (...args: never[]) => unknown;

type Predicate = (value: unknown) => unknown;

/** The parts of a Zod schema definition this script looks at. */
interface ZodDefWithMeta {
    readonly type?: string;
    readonly fn?: unknown;
    readonly check?: unknown;
    readonly predicate?: unknown;
    readonly format?: string;
    readonly shape?: (() => Record<string, unknown>) | Record<string, unknown>;
    readonly cls?: unknown;
    readonly checks?: readonly unknown[];
    readonly innerType?: unknown;
    readonly element?: unknown;
    readonly options?: readonly unknown[];
    readonly left?: unknown;
    readonly right?: unknown;
    readonly catchall?: unknown;
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

/** A top-level export of an intermediate declaration file. */
interface PluginDeclaration {
    /** `value` for const/function, `type` for type alias/interface. */
    readonly kind: "value" | "type";
    /** The annotated type of a `const`. Undefined for the others. */
    readonly typeText: string | undefined;
    /** The whole statement, including its leading JSDoc. */
    readonly text: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toPosix(p: string): string {
    return p.replaceAll("\\", "/");
}

function ensureValidTsIdentifier(name: string, context: string): void {
    invariant(
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name),
        `Invalid TypeScript identifier "${name}" (${context}). ` +
            `Rename the export or adjust deriveTypeName().`,
    );
}

function isFunction(value: unknown): value is Predicate & AnyConstructor {
    return typeof value === "function";
}

function getZodDef(schema: z.ZodType): ZodDefWithMeta {
    return schema.def;
}

async function writeFileEnsuringDir(
    filePath: string,
    content: string,
): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
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
    if (RESERVED_TYPE_NAMES.includes(base)) {
        return `${base}Type`;
    }

    ensureValidTsIdentifier(base, `derived from export "${schemaExportName}"`);
    return base;
}

// =============================================================================
// Schema Metadata Extraction
// =============================================================================

/**
 * Reads the metadata (`.meta()` / `.describe()`) of a Zod schema.
 */
function readSchemaMeta(schema: z.ZodType): SchemaMeta {
    return schema.meta() ?? {};
}

function escapeForJsDoc(text: string): string {
    return text.replaceAll("*/", "*\\/");
}

/**
 * Builds a JSDoc comment block from schema metadata.
 */
function buildJsDoc(schema: z.ZodType): string {
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

function isProbablyZodCustom(schema: z.ZodType): boolean {
    return schema instanceof z.ZodCustom || schema.def.type === "custom";
}

function getCustomPredicate(schema: z.ZodType): Predicate | null {
    const def = getZodDef(schema);
    const candidate = def.fn ?? def.check ?? def.predicate ?? null;
    return isFunction(candidate) ? candidate : null;
}

function sampleValueForCtor(
    ctor: unknown,
): Uint8Array | ArrayBuffer | Date | null {
    if (ctor === Uint8Array) return new Uint8Array();
    if (ctor === ArrayBuffer) return new ArrayBuffer(0);
    if (ctor === Date) return new Date(0);
    return null;
}

function matchesInstanceofViaDefChecks(
    schema: z.ZodType,
    ctor: unknown,
): boolean {
    const checks = getZodDef(schema).checks;
    if (!checks) return false;

    for (const check of checks) {
        if (!isRecord(check)) continue;
        const kind = check["kind"] ?? check["type"] ?? check["check"];
        const cls =
            check["cls"] ??
            check["class"] ??
            check["ctor"] ??
            check["instanceof"];
        if (kind === "instanceof" && cls === ctor) return true;
    }
    return false;
}

/**
 * Attempts to detect z.instanceof by checking cls property or fn behavior.
 * Returns the constructor if detected, undefined otherwise.
 */
function detectInstanceofClass(schema: z.ZodType): AnyConstructor | undefined {
    const def = getZodDef(schema);

    // Check cls property (Zod v4 may store class reference here)
    if (isFunction(def.cls)) {
        return def.cls;
    }

    // Check predicate function for instanceof check
    const pred = getCustomPredicate(schema);
    if (!pred) return undefined;

    // Test known constructors
    const knownCtors: readonly AnyConstructor[] = [
        Uint8Array,
        ArrayBuffer,
        Date,
    ];
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
    if (typeof def.fn === "function") {
        const fnStr = def.fn.toString();
        for (const ctor of knownCtors) {
            if (fnStr.includes(ctor.name) || fnStr.includes("instanceof")) {
                return ctor;
            }
        }
    }

    return undefined;
}

/**
 * Attempts to detect known custom schemas and returns a TypeNode override.
 * - If schema has `.meta({ tsType: "..." })`, that always wins.
 * - Otherwise, tries to identify known safe types (Uint8Array, ArrayBuffer).
 * - Returns null if unknown (caller should throw for error-intolerant behavior).
 */
function getCustomOverrideTypeNode(
    schema: z.ZodType,
    context: string,
): ts.TypeNode | null {
    const meta = readSchemaMeta(schema);

    // Explicit tsType always wins
    if (typeof meta.tsType === "string" && meta.tsType.trim()) {
        return parseTypeNodeFromString(meta.tsType.trim(), context);
    }

    // Check via internal checks array
    if (matchesInstanceofViaDefChecks(schema, Uint8Array)) {
        return parseTypeNodeFromString("Uint8Array<ArrayBuffer>", context);
    }
    if (matchesInstanceofViaDefChecks(schema, ArrayBuffer)) {
        return ts.factory.createTypeReferenceNode("ArrayBuffer", undefined);
    }

    // Try detecting instanceof class
    const detectedClass = detectInstanceofClass(schema);
    if (detectedClass === Uint8Array) {
        return parseTypeNodeFromString("Uint8Array<ArrayBuffer>", context);
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
            { ctor: Uint8Array, tsName: "Uint8Array<ArrayBuffer>" },
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
                return parseTypeNodeFromString(c.tsName, context);
            }
        }
    }

    return null;
}

// =============================================================================
// Format-based Schema Handling (z.url(), z.int(), etc.)
// =============================================================================

function getFormatBasedType(schema: z.ZodType): ts.TypeNode | null {
    const format = getZodDef(schema).format;
    if (!format) return null;

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
        if (stringFormats.includes(format)) {
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
        if (numberFormats.includes(format)) {
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
): Set<z.ZodType> {
    const found = new Set<z.ZodType>();
    const visitedObjects = new WeakSet<object>();

    const walk = (value: unknown): void => {
        if (value instanceof z.ZodType) {
            if (found.has(value)) return;
            found.add(value);

            walk(value.def);

            // Handle ZodObject shape. Other schemas have no shape.
            const shape = getZodDef(value).shape;
            if (typeof shape === "function") {
                if (shape.length === 0) walk(shape());
            } else if (shape) {
                walk(shape);
            }
            return;
        }

        if (Array.isArray(value)) {
            for (const v of value) walk(v);
            return;
        }

        if (isRecord(value)) {
            if (visitedObjects.has(value)) return;
            visitedObjects.add(value);

            for (const v of Object.values(value)) {
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
    allSchemas: Set<z.ZodType>,
    context: string,
): TypeOverrideMap {
    const overrides: TypeOverrideMap = new Map();

    for (const schema of allSchemas) {
        // Skip if already overridden
        if (overrides.has(schema)) continue;

        // Handle format-based schemas (z.url(), z.int(), etc.)
        const formatType = getFormatBasedType(schema);
        if (formatType) {
            // A new node for every use: nodes get documented in place
            overrides.set(schema, () => {
                const fresh = getFormatBasedType(schema);
                invariant(fresh, "unreachable: the format type disappeared");
                return fresh;
            });
            continue;
        }

        // Handle custom schemas
        if (isProbablyZodCustom(schema)) {
            const override = getCustomOverrideTypeNode(schema, context);
            if (override) {
                overrides.set(schema, () => {
                    const fresh = getCustomOverrideTypeNode(schema, context);
                    invariant(fresh, "unreachable: the override disappeared");
                    return fresh;
                });
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
                    `Current meta.tsType: ${typeof meta.tsType === "string" ? JSON.stringify(meta.tsType) : "(none)"}\n` +
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
            value instanceof z.ZodType,
            `In ${fileContext}: export "${exportName}" ends with "${SCHEMA_EXPORT_SUFFIX}" ` +
                `but is not a Zod schema. Fix the export or rename it.`,
        );

        entries.push({
            typeName: deriveTypeName(exportName),
            exportName,
            schema: value,
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
// Intermediate Declarations (vite-plugin-dts output)
// =============================================================================

function hasExportModifier(stmt: ts.Statement): boolean {
    return (
        ts.canHaveModifiers(stmt) &&
        (ts.getModifiers(stmt) ?? []).some(
            (m) => m.kind === ts.SyntaxKind.ExportKeyword,
        )
    );
}

/**
 * Parses an intermediate declaration file of a schema module into its exports.
 * Only the shapes emitted for schema modules are supported; anything else throws.
 */
function readPluginDeclarations(
    dtsPath: string,
    content: string,
): Map<string, PluginDeclaration> {
    const source = ts.createSourceFile(
        dtsPath,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const declarations = new Map<string, PluginDeclaration>();

    const add = (name: string, declaration: PluginDeclaration): void => {
        invariant(
            !declarations.has(name),
            `[${dtsPath}] "${name}" is declared more than once (overloads are unsupported).`,
        );
        declarations.set(name, declaration);
    };

    for (const stmt of source.statements) {
        if (ts.isImportDeclaration(stmt)) {
            invariant(
                ts.isStringLiteral(stmt.moduleSpecifier) &&
                    stmt.moduleSpecifier.text === "zod",
                `[${dtsPath}] Unsupported import: ${stmt.getText(source)}. ` +
                    `Schema modules may only import from "zod".`,
            );
            continue;
        }

        invariant(
            hasExportModifier(stmt),
            `[${dtsPath}] Unsupported non-exported statement: ${stmt.getText(source)}`,
        );

        if (ts.isVariableStatement(stmt)) {
            const [decl, ...rest] = stmt.declarationList.declarations;
            invariant(
                decl && rest.length === 0 && ts.isIdentifier(decl.name),
                `[${dtsPath}] Unsupported variable statement: ${stmt.getText(source)}`,
            );
            invariant(
                decl.type,
                `[${dtsPath}] "${decl.name.text}" has no type annotation.`,
            );
            add(decl.name.text, {
                kind: "value",
                typeText: decl.type.getText(source),
                text: stmt.getFullText(source).trim(),
            });
        } else if (ts.isFunctionDeclaration(stmt)) {
            invariant(
                stmt.name,
                `[${dtsPath}] Anonymous function declaration is unsupported.`,
            );
            add(stmt.name.text, {
                kind: "value",
                typeText: undefined,
                text: stmt.getFullText(source).trim(),
            });
        } else if (
            ts.isTypeAliasDeclaration(stmt) ||
            ts.isInterfaceDeclaration(stmt)
        ) {
            add(stmt.name.text, {
                kind: "type",
                typeText: undefined,
                text: stmt.getFullText(source).trim(),
            });
        } else {
            throw new Error(
                `[${dtsPath}] Unsupported exported statement: ${stmt.getText(source)}`,
            );
        }
    }

    return declarations;
}

/**
 * Maps a path inside the declaration cache to its place in `dist`.
 * `types/v0/X.d.ts` (cache) becomes `v0/X.d.ts`.
 */
function cachePathToDistPath(cachePath: string): string {
    const rel = path.relative(DTS_CACHE_DIR, cachePath);
    const parts = toPosix(rel).split("/");
    if (parts[0] === "types") parts.shift();
    return path.join(DIST_DIR, ...parts);
}

/**
 * Rewrites the relative module specifiers of an intermediate declaration file
 * so they point to the matching files in `dist`, with explicit `.js` extensions.
 */
function rewriteRelativeSpecifiers(
    content: string,
    cacheFilePath: string,
): string {
    const source = ts.createSourceFile(
        cacheFilePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const distFilePath = cachePathToDistPath(cacheFilePath);

    const replacements: Array<{ start: number; end: number; text: string }> =
        [];

    for (const stmt of source.statements) {
        if (!ts.isImportDeclaration(stmt) && !ts.isExportDeclaration(stmt)) {
            continue;
        }
        const specifier = stmt.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier)) continue;
        if (!specifier.text.startsWith(".")) continue;

        const base = path.resolve(path.dirname(cacheFilePath), specifier.text);
        const target = existsSync(`${base}.d.ts`)
            ? `${base}.d.ts`
            : path.join(base, "index.d.ts");
        invariant(
            existsSync(target),
            `[${cacheFilePath}] Cannot resolve "${specifier.text}".`,
        );

        let rel = toPosix(
            path.relative(
                path.dirname(distFilePath),
                cachePathToDistPath(target),
            ),
        ).replace(/\.d\.ts$/, ".js");
        if (!rel.startsWith(".")) rel = `./${rel}`;

        replacements.push({
            start: specifier.getStart(source),
            end: specifier.getEnd(),
            text: JSON.stringify(rel),
        });
    }

    let result = content;
    for (const r of replacements.sort((a, b) => b.start - a.start)) {
        result = result.slice(0, r.start) + r.text + result.slice(r.end);
    }
    return result;
}

// =============================================================================
// JSDoc of Nested Types
// =============================================================================

/**
 * Every description of a schema is documented where its value shows up in the type:
 * - the field of an object: JSDoc on the property
 * - the option of a union (or intersection): JSDoc before the option
 * - the item of an array: JSDoc before the item type, in parentheses
 * - the root of a schema: JSDoc on the type and on the schema
 * The same places `z.toJSONSchema()` puts a `description`, in the same order.
 * `tests/built-output.test.ts` compares both.
 */

/** Schemas which describe the very same value as the schema they wrap. */
const DESCRIBING_WRAPPERS: readonly string[] = [
    "optional",
    "nullable",
    "default",
    "prefault",
    "catch",
];

/** Schemas whose type has no nested type, so there is nothing to document inside. */
const LEAF_SCHEMA_TYPES: readonly string[] = [
    "string",
    "number",
    "boolean",
    "bigint",
    "date",
    "literal",
    "enum",
    "custom",
    "null",
    "undefined",
    "any",
    "unknown",
    "never",
];

function isZodType(value: unknown): value is z.ZodType {
    return value instanceof z.ZodType;
}

/**
 * The description of the value a schema validates: its own, otherwise the one of
 * the schema it wraps (`.optional()`, `.default()`...). Like `z.toJSONSchema()`.
 */
function describedBy(schema: z.ZodType): string | undefined {
    const description = readSchemaMeta(schema).description;
    if (typeof description === "string" && description.trim()) {
        return description.trim();
    }
    const def = getZodDef(schema);
    if (
        def.type !== undefined &&
        DESCRIBING_WRAPPERS.includes(def.type) &&
        isZodType(def.innerType)
    ) {
        return describedBy(def.innerType);
    }
    return undefined;
}

/** @param ownLine Whether the comment is on its own line, as for a property. */
function addJsDoc<T extends ts.Node>(
    node: T,
    description: string,
    ownLine: boolean,
): T {
    ts.addSyntheticLeadingComment(
        node,
        ts.SyntaxKind.MultiLineCommentTrivia,
        `* ${escapeForJsDoc(description)} `,
        ownLine,
    );
    return node;
}

function unparenthesize(node: ts.TypeNode): ts.TypeNode {
    return ts.isParenthesizedTypeNode(node) ? unparenthesize(node.type) : node;
}

function needsParentheses(node: ts.TypeNode): boolean {
    return (
        ts.isUnionTypeNode(node) ||
        ts.isIntersectionTypeNode(node) ||
        ts.isFunctionTypeNode(node)
    );
}

/** Documents the member of a union or an intersection. */
function documentMember(
    node: ts.TypeNode,
    description: string | undefined,
): ts.TypeNode {
    if (!description) return node;
    const wrapped = needsParentheses(node)
        ? ts.factory.createParenthesizedType(node)
        : node;
    return addJsDoc(wrapped, description, false);
}

/** Documents the item type of an array. Always in parentheses, to tell it from the array. */
function documentItem(
    node: ts.TypeNode,
    description: string | undefined,
): ts.TypeNode {
    if (!description) return node;
    return ts.factory.createParenthesizedType(
        documentMember(node, description),
    );
}

/**
 * Documents the members of a union or an intersection.
 * @param schemas The schemas the members were generated from, in order.
 */
function documentMembers(
    schemas: readonly unknown[] | undefined,
    nodes: ts.NodeArray<ts.TypeNode>,
    overrides: TypeOverrideMap,
): ts.NodeArray<ts.TypeNode> {
    invariant(
        schemas?.length === nodes.length,
        "The members of a type do not match its schemas.",
    );
    return ts.factory.createNodeArray(
        nodes.map((member, i) => {
            const schema = schemas[i];
            invariant(isZodType(schema), "A member is not a schema.");
            return documentMember(
                documentType(schema, unparenthesize(member), overrides),
                describedBy(schema),
            );
        }),
    );
}

/**
 * Documents the nested types of a type generated by zod-to-ts, which only
 * documents the fields of objects. See "JSDoc of Nested Types".
 * @param schema The schema the node was generated from.
 * @param node The node zod-to-ts generated for `schema`.
 * @param overrides The overrides given to zod-to-ts: their nodes are left as is.
 * @returns The documented node, which replaces `node`.
 */
function documentType(
    schema: z.ZodType,
    node: ts.TypeNode,
    overrides: TypeOverrideMap,
): ts.TypeNode {
    if (overrides.has(schema)) return node;

    const def = getZodDef(schema);
    const kind = def.type;
    invariant(kind !== undefined, "A schema has no type.");

    if (LEAF_SCHEMA_TYPES.includes(kind)) return node;

    switch (kind) {
        case "object": {
            invariant(
                !def.catchall,
                "An object with a catchall cannot be documented.",
            );
            invariant(
                ts.isTypeLiteralNode(node),
                `An object schema generated ${ts.SyntaxKind[node.kind]}, not a type literal.`,
            );
            const shape =
                typeof def.shape === "function" ? def.shape() : def.shape;
            const fields = Object.entries(shape ?? {});
            invariant(
                fields.length === node.members.length,
                "The fields of an object do not match its type literal.",
            );

            const members = node.members.map((member, i) => {
                const field = fields[i];
                invariant(
                    field &&
                        isZodType(field[1]) &&
                        ts.isPropertySignature(member) &&
                        member.type &&
                        (ts.isIdentifier(member.name) ||
                            ts.isStringLiteral(member.name)) &&
                        member.name.text === field[0],
                    `Property ${i} does not match field ${field?.[0]}.`,
                );
                const updated = ts.factory.updatePropertySignature(
                    member,
                    member.modifiers,
                    member.name,
                    member.questionToken,
                    documentType(field[1], member.type, overrides),
                );
                // Own documentation: the one of zod-to-ts is replaced
                ts.setSyntheticLeadingComments(updated, undefined);
                const description = describedBy(field[1]);
                return description
                    ? addJsDoc(updated, description, true)
                    : updated;
            });
            return ts.factory.updateTypeLiteralNode(
                node,
                ts.factory.createNodeArray(members),
            );
        }

        case "array": {
            invariant(
                ts.isArrayTypeNode(node) && isZodType(def.element),
                "An array schema did not generate an array type.",
            );
            const item = documentType(
                def.element,
                unparenthesize(node.elementType),
                overrides,
            );
            return ts.factory.updateArrayTypeNode(
                node,
                documentItem(item, describedBy(def.element)),
            );
        }

        case "union": {
            invariant(
                ts.isUnionTypeNode(node),
                "A union schema did not generate a union type.",
            );
            return ts.factory.updateUnionTypeNode(
                node,
                documentMembers(def.options, node.types, overrides),
            );
        }

        case "intersection": {
            invariant(
                ts.isIntersectionTypeNode(node),
                "An intersection schema did not generate an intersection type.",
            );
            return ts.factory.updateIntersectionTypeNode(
                node,
                documentMembers([def.left, def.right], node.types, overrides),
            );
        }

        case "optional":
        case "nullable": {
            // `T | undefined` and `T | null`: only T has nested types
            invariant(
                ts.isUnionTypeNode(node) &&
                    node.types.length === 2 &&
                    isZodType(def.innerType),
                `A ${kind} schema did not generate a union of two types.`,
            );
            const [inner, extra] = node.types;
            invariant(inner && extra, "unreachable: no union members");
            return ts.factory.updateUnionTypeNode(
                node,
                ts.factory.createNodeArray([
                    documentType(
                        def.innerType,
                        unparenthesize(inner),
                        overrides,
                    ),
                    extra,
                ]),
            );
        }

        case "default":
        case "prefault":
        case "catch": {
            invariant(isZodType(def.innerType), "A wrapper wraps no schema.");
            return documentType(def.innerType, node, overrides);
        }

        default:
            throw new Error(
                `Cannot document the nested types of a "${kind}" schema. ` +
                    `Support it in documentType() of scripts/generate-types.ts.`,
            );
    }
}

// =============================================================================
// Type Generation
// =============================================================================

/**
 * Generates TypeScript declarations for a schema module.
 * @param entries The schema exports of the module.
 * @param runtimeExportNames Every runtime export of the module.
 * @param overrides zod-to-ts type overrides for the module's schemas.
 * @param pluginDeclarations The intermediate declarations of the module.
 * @param context Used in error messages.
 */
function generateTypesForModule(
    entries: SchemaEntry[],
    runtimeExportNames: readonly string[],
    overrides: TypeOverrideMap,
    pluginDeclarations: ReadonlyMap<string, PluginDeclaration>,
    context: string,
): string {
    const out: string[] = [
        "// Auto-generated TypeScript declarations from Zod schemas. DO NOT EDIT.",
        "// Regenerate with: pnpm generate-types",
        "",
        'import * as z from "zod";',
        "",
    ];

    const auxiliaryTypeStore = createAuxiliaryTypeStore();
    const declaredNames = new Set<string>();
    const generatedTypeNames = new Set(entries.map((e) => e.typeName));

    for (const { typeName, exportName, schema } of entries) {
        const jsdoc = buildJsDoc(schema);

        // The plain type, with JSDoc on every property (zod-to-ts reads `.meta()`)
        const { node } = zodToTs(schema, { auxiliaryTypeStore, overrides });
        const documented = documentType(schema, node, overrides);
        const typeString = printNode(createTypeAlias(documented, typeName));

        if (jsdoc) out.push(jsdoc.trimEnd());
        out.push(`export ${typeString}`);
        out.push("");

        // The schema itself, typed by the precise declaration emitted by tsc
        const declaration = pluginDeclarations.get(exportName);
        invariant(
            declaration?.kind === "value" && declaration.typeText,
            `[${context}] "${exportName}" has no declaration in the intermediate .d.ts.`,
        );
        if (jsdoc) out.push(jsdoc.trimEnd());
        out.push(
            `export declare const ${exportName}: ${declaration.typeText};`,
        );
        out.push("");

        declaredNames.add(exportName);
    }

    // Every other export is declared exactly as tsc emitted it
    for (const [name, declaration] of pluginDeclarations) {
        if (declaration.kind === "type") {
            invariant(
                generatedTypeNames.has(name),
                `[${context}] Type "${name}" is exported but no "${name}${SCHEMA_EXPORT_SUFFIX}" ` +
                    `schema generates it. Export a schema for it, or do not export the type.`,
            );
            continue;
        }
        if (declaredNames.has(name)) continue;
        invariant(
            !name.endsWith(SCHEMA_EXPORT_SUFFIX),
            `[${context}] "${name}" ends with "${SCHEMA_EXPORT_SUFFIX}" but is not a schema.`,
        );
        out.push(declaration.text);
        out.push("");
        declaredNames.add(name);
    }

    // Nothing the runtime exports may be left without a declaration
    for (const name of runtimeExportNames) {
        invariant(
            declaredNames.has(name),
            `[${context}] Runtime export "${name}" has no declaration.`,
        );
    }

    // Emit auxiliary type definitions (deterministic order)
    const aux = [...auxiliaryTypeStore.definitions.values()].sort((a, b) =>
        a.identifier.text.localeCompare(b.identifier.text),
    );

    for (const def of aux) {
        const defStr = printNode(def.node).trim();
        invariant(
            defStr.startsWith("type ") || defStr.startsWith("interface "),
            `Unexpected auxiliary definition emitted by zod-to-ts: "${defStr}"`,
        );
        out.push(defStr);
        out.push("");
    }
    if (aux.length > 0) {
        // Keep the auxiliary types private
        out.push("export {};");
        out.push("");
    }

    return `${out.join("\n").trimEnd()}\n`;
}

// =============================================================================
// Entry Point & Barrel Generation
// =============================================================================

/**
 * Generates the entry declarations (`index.d.ts`), the counterpart of `src/index.ts`.
 * `characterVersions` are the versions which have a `Character` schema.
 */
function generateMainIndexDts(
    characterVersions: Array<{ version: number; versionDir: string }>,
): string {
    const lines: string[] = [
        "// Auto-generated entry declarations. DO NOT EDIT.",
        "// Regenerate with: pnpm generate-types",
    ];

    invariant(
        characterVersions.length > 0,
        "No CharacterSchema export found: cannot generate the entry declarations.",
    );

    for (const v of characterVersions) {
        const vTag = `V${v.version}`;
        const rel = JSON.stringify(`./${v.versionDir}/Character/Character.js`);
        lines.push(
            `import type { Character as Character${vTag} } from ${rel};`,
            `import { CharacterSchema as Character${vTag}Schema } from ${rel};`,
            `export { Character${vTag}Schema };`,
            `export type { Character${vTag} };`,
            "",
        );
    }

    lines.push(
        "/**",
        " * Version-schema pair of character specification",
        " */",
        "export declare const characterMap: {",
    );
    for (const v of characterVersions) {
        lines.push(
            `    readonly ${v.version}: typeof CharacterV${v.version}Schema;`,
        );
    }
    lines.push("};", "");

    lines.push(
        "/**",
        " * Version-type pair of character specification",
        " */",
        "export type CharacterMap = {",
    );
    for (const v of characterVersions) {
        lines.push(
            `    ${JSON.stringify(String(v.version))}: CharacterV${v.version};`,
        );
    }
    lines.push("};", "");

    const latest = characterVersions[characterVersions.length - 1];
    invariant(latest, "unreachable: no character version");
    lines.push(
        "/**",
        " * Latest character specification",
        " */",
        `declare const _default: typeof CharacterV${latest.version}Schema;`,
        "export default _default;",
        "",
    );

    return lines.join("\n");
}

/**
 * Copies a plain intermediate declaration file (a top-level module)
 * into `dist`, with its specifiers rewritten.
 * @returns The path of the written file, relative to `dist`.
 */
async function copyPluginDeclarationFile(
    cacheFilePath: string,
): Promise<string> {
    const content = await fs.readFile(cacheFilePath, "utf8");
    const rewritten = rewriteRelativeSpecifiers(content, cacheFilePath).replace(
        /\r?\n\/\/# sourceMappingURL=.*$/,
        "",
    );
    const distFilePath = cachePathToDistPath(cacheFilePath);
    await writeFileEnsuringDir(
        distFilePath,
        `// Auto-generated from src. DO NOT EDIT.\n${rewritten.trimEnd()}\n`,
    );
    return toPosix(path.relative(DIST_DIR, distFilePath));
}

/**
 * The schema modules a barrel re-exports, folder barrels (`index.d.ts`) expanded.
 * Only `export * from "./relative"` is supported in a barrel.
 * @returns The intermediate declaration files of the schema modules.
 */
function resolveBarrelModules(barrelPath: string): string[] {
    const source = ts.createSourceFile(
        barrelPath,
        readFileSync(barrelPath, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const modules: string[] = [];

    for (const stmt of source.statements) {
        const specifier = ts.isExportDeclaration(stmt)
            ? stmt.moduleSpecifier
            : undefined;
        invariant(
            ts.isExportDeclaration(stmt) &&
                !stmt.exportClause &&
                !stmt.isTypeOnly &&
                specifier &&
                ts.isStringLiteral(specifier) &&
                specifier.text.startsWith("."),
            `[${barrelPath}] Unsupported barrel statement: ${stmt.getText(source)}. ` +
                `Barrels may only contain \`export * from "./relative"\`.`,
        );

        const base = path.resolve(path.dirname(barrelPath), specifier.text);
        if (existsSync(`${base}.d.ts`)) {
            modules.push(`${base}.d.ts`);
        } else {
            const nested = path.join(base, "index.d.ts");
            invariant(
                existsSync(nested),
                `[${barrelPath}] Cannot resolve "${specifier.text}".`,
            );
            modules.push(...resolveBarrelModules(nested));
        }
    }

    return modules;
}

/**
 * Writes the declarations of the barrel of a spec version, `v0/index.ts` for
 * `v0.d.ts`. The folder barrels have no runtime counterpart (they are not
 * built), so the file re-exports the schema modules directly.
 * @param barrelPath The intermediate declaration of the barrel, e.g. `.../types/v0/index.d.ts`.
 * @returns The path of the written file, relative to `dist`.
 */
async function writeVersionBarrel(barrelPath: string): Promise<string> {
    const outPath = path.join(
        DIST_DIR,
        `${path.relative(DTS_CACHE_TYPES_DIR, path.dirname(barrelPath))}.d.ts`,
    );
    const lines = resolveBarrelModules(barrelPath).map((module) => {
        const target = cachePathToDistPath(module);
        invariant(
            existsSync(target),
            `Barrel target is not generated: ${target}`,
        );
        let rel = toPosix(path.relative(path.dirname(outPath), target)).replace(
            /\.d\.ts$/,
            ".js",
        );
        if (!rel.startsWith(".")) rel = `./${rel}`;
        return `export * from ${JSON.stringify(rel)};`;
    });
    invariant(
        new Set(lines).size === lines.length,
        `[${barrelPath}] A schema module is re-exported twice.`,
    );

    await writeFileEnsuringDir(
        outPath,
        `// Auto-generated barrel export. DO NOT EDIT.\n${lines.join("\n")}\n`,
    );
    return toPosix(path.relative(DIST_DIR, outPath));
}

// =============================================================================
// Main Process
// =============================================================================

async function main(): Promise<void> {
    console.log("Scanning source files...\n");

    invariant(
        existsSync(SRC_DIR),
        `Source directory does not exist: ${SRC_DIR}`,
    );
    invariant(
        existsSync(DTS_CACHE_TYPES_DIR),
        `Intermediate declarations not found: ${DTS_CACHE_TYPES_DIR}. Run "vite build" first (pnpm build).`,
    );

    const sourceFiles = await glob("**/*.ts", {
        cwd: SRC_DIR,
        ignore: [...IGNORE_GLOBS],
        absolute: false,
    });

    invariant(sourceFiles.length > 0, `No source files found in ${SRC_DIR}`);

    console.log(`Found ${sourceFiles.length} source file(s)\n`);

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
        const outFsPath = path.join(
            DIST_DIR,
            ...`${modulePosixPath}.d.ts`.split("/"),
        );
        const pluginDtsPath = path.join(
            DTS_CACHE_TYPES_DIR,
            ...`${modulePosixPath}.d.ts`.split("/"),
        );

        // Import the module. Path aliases (`@/`) are resolved by tsx.
        let moduleExports: unknown;
        try {
            moduleExports = await import(pathToFileURL(srcPath).href);
        } catch (e) {
            throw new TypeGenerationError(
                `Failed to import module`,
                srcPath,
                e,
            );
        }
        invariant(
            isRecord(moduleExports),
            `[${relPosix}] The module namespace is not an object.`,
        );

        const entries = extractSchemasOrThrow(moduleExports, relPosix);

        if (entries.length === 0) {
            throw new TypeGenerationError(
                "The module exports no schema, so it cannot be declared. " +
                    "Move it out of src/types, or export a schema.",
                srcPath,
            );
        }

        const allSchemas = collectAllSchemasFromModuleExports(moduleExports);
        const overrides = buildOverridesOrThrow(
            allSchemas,
            `module ${relPosix}`,
        );

        invariant(
            existsSync(pluginDtsPath),
            `[${relPosix}] Intermediate declaration not found: ${pluginDtsPath}. Run "vite build" first.`,
        );
        const pluginDeclarations = readPluginDeclarations(
            pluginDtsPath,
            await fs.readFile(pluginDtsPath, "utf8"),
        );

        let content: string;
        try {
            content = generateTypesForModule(
                entries,
                Object.keys(moduleExports),
                overrides,
                pluginDeclarations,
                relPosix,
            );
        } catch (e) {
            throw new TypeGenerationError(
                `Failed to generate declarations`,
                srcPath,
                e,
            );
        }

        await writeFileEnsuringDir(outFsPath, content);

        console.log(
            `Generated: ${modulePosixPath}.d.ts (${entries.length} type(s))`,
        );
        generatedModules.push(modulePosixPath);

        // Detect character versions
        const characterModule = /^(v\d+)\/Character\/Character$/.exec(
            modulePosixPath,
        );
        if (
            characterModule?.[1] &&
            entries.some((e) => e.exportName === "CharacterSchema")
        ) {
            characterVersions.push({
                version: Number(characterModule[1].slice(1)),
                versionDir: characterModule[1],
            });
        }
    }

    console.log("");

    // Version barrels (`v0/index.ts`), flattened into `v0.d.ts`
    const versionBarrels = await glob("v[0-9]*/index.d.ts", {
        cwd: DTS_CACHE_TYPES_DIR,
        absolute: true,
    });
    invariant(
        versionBarrels.length > 0,
        "No version barrel (v<N>/index.ts) found.",
    );
    for (const barrel of versionBarrels.sort((a, b) => a.localeCompare(b))) {
        console.log(`Generated barrel: ${await writeVersionBarrel(barrel)}`);
    }

    // Top-level modules of src (everything but the entry point), e.g. utils.ts
    const topLevelModules = await glob("*.d.ts", {
        cwd: DTS_CACHE_DIR,
        ignore: ["index.d.ts"],
        absolute: true,
    });
    for (const file of topLevelModules.sort((a, b) => a.localeCompare(b))) {
        console.log(`Generated: ${await copyPluginDeclarationFile(file)}`);
    }

    // Entry point
    const uniqueCharacterVersions = new Map<number, string>();
    for (const v of characterVersions) {
        uniqueCharacterVersions.set(v.version, v.versionDir);
    }
    const normalizedCharacterVersions = [...uniqueCharacterVersions.entries()]
        .map(([version, versionDir]) => ({ version, versionDir }))
        .sort((a, b) => a.version - b.version);

    await writeFileEnsuringDir(
        path.join(DIST_DIR, "index.d.ts"),
        generateMainIndexDts(normalizedCharacterVersions),
    );
    console.log("Generated: index.d.ts");

    // Summary
    console.log(`\n${"=".repeat(50)}`);
    console.log("Type generation complete!");
    console.log(`   Generated: ${generatedModules.length} module(s)`);
    console.log("=".repeat(50));
}

// =============================================================================
// Entry Point
// =============================================================================

try {
    await main();
} catch (error) {
    console.error("\nType generation failed!\n");

    if (error instanceof TypeGenerationError) {
        console.error(`File: ${error.filePath}`);
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
