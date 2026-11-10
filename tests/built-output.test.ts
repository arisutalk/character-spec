/**
 * Tests of the BUILT package (`dist`), as consumers get it.
 *
 * The `.meta({ description })` of the schemas is the single source of the
 * documentation. It has to survive the build twice:
 * - in the runtime schemas, so `z.toJSONSchema()` carries the descriptions
 * - in the generated declarations, as JSDoc
 *
 * Needs `pnpm build` first (`pnpm test` does it).
 */

import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as z from "zod";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");

interface PackageJson {
    exports: Record<string, string | { types: string; default: string }>;
}

const packageJson: PackageJson = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
);

// -----------------------------------------------------------------------------
// Modules: every schema module of src, with its built counterpart
// -----------------------------------------------------------------------------

/** `v0/Character/Character` for `src/types/v0/Character/Character.ts` */
const moduleNames = readdirSync(join(ROOT, "src/types"), { recursive: true })
    .map((file) => String(file).replaceAll("\\", "/"))
    .filter((file) => file.endsWith(".ts") && !file.endsWith("index.ts"))
    .map((file) => file.replace(/\.ts$/, ""))
    .sort();

const sourceModules = import.meta.glob<Record<string, unknown>>(
    ["../src/types/**/*.ts", "!../src/types/**/index.ts"],
    { eager: true },
);

function sourceExports(moduleName: string): Record<string, unknown> {
    const found = sourceModules[`../src/types/${moduleName}.ts`];
    if (!found) throw new Error(`No source module: ${moduleName}`);
    return found;
}

async function importBuilt(file: string): Promise<Record<string, unknown>> {
    return import(/* @vite-ignore */ pathToFileURL(join(DIST, file)).href);
}

function schemaExports(
    exports: Record<string, unknown>,
): Array<[string, z.ZodType]> {
    const schemas: Array<[string, z.ZodType]> = [];
    for (const [name, value] of Object.entries(exports)) {
        if (name.endsWith("Schema") && value instanceof z.ZodType) {
            schemas.push([name, value]);
        }
    }
    return schemas;
}

// -----------------------------------------------------------------------------
// Description collection
// -----------------------------------------------------------------------------

function descriptionOf(schema: z.ZodType): string | undefined {
    const description = schema.meta()?.description;
    return typeof description === "string" ? description : undefined;
}

/**
 * Every schema reachable from `root`, `root` included.
 * A wrapper (`.optional()`, `.default()`...) with its own description hides
 * the description of the schema it wraps, so wrapped ones are `shadowed`.
 */
function reachableSchemas(
    root: z.ZodType,
): Map<z.ZodType, { shadowed: boolean }> {
    const found = new Map<z.ZodType, { shadowed: boolean }>();
    const seen = new WeakSet<object>();
    const walk = (value: unknown, shadowed: boolean): void => {
        if (value instanceof z.ZodType) {
            const known = found.get(value);
            if (known && (!known.shadowed || shadowed)) return;
            found.set(value, { shadowed });
            const def = value.def;
            const inner = "innerType" in def ? def.innerType : undefined;
            const hides = shadowed || descriptionOf(value) !== undefined;
            if (inner instanceof z.ZodType) walk(inner, hides);
            for (const child of Object.values(def)) {
                if (child !== inner) walk(child, false);
            }
            return;
        }
        if (typeof value !== "object" || value === null) return;
        if (seen.has(value)) return;
        seen.add(value);
        for (const child of Object.values(value)) walk(child, false);
    };
    walk(root, false);
    return found;
}

/** The descriptions of every schema reachable from `root`, but the hidden ones. */
function allDescriptions(root: z.ZodType): Set<string> {
    const descriptions = new Set<string>();
    for (const [schema, { shadowed }] of reachableSchemas(root)) {
        const description = descriptionOf(schema);
        if (description && !shadowed) descriptions.add(description);
    }
    return descriptions;
}

/** All `description` values of a JSON Schema document. */
function jsonSchemaDescriptions(json: unknown): Set<string> {
    const descriptions = new Set<string>();
    const walk = (value: unknown): void => {
        if (Array.isArray(value)) {
            for (const item of value) walk(item);
        } else if (typeof value === "object" && value !== null) {
            for (const [key, child] of Object.entries(value)) {
                if (key === "description" && typeof child === "string") {
                    descriptions.add(child);
                } else {
                    walk(child);
                }
            }
        }
    };
    walk(json);
    return descriptions;
}

/**
 * Where the JSON Schema of a schema describes something: the path and the text
 * of every `description`, parent first, then the properties, the items and the
 * options, in order. The root, which is documented apart, is not listed.
 */
function descriptionSites(
    json: unknown,
): Array<{ path: string; description: string }> {
    const sites: Array<{ path: string; description: string }> = [];
    const walk = (node: unknown, path: string): void => {
        if (!isRecord(node)) return;
        if (path !== "" && typeof node["description"] === "string") {
            sites.push({ path, description: node["description"] });
        }
        const properties = node["properties"];
        if (isRecord(properties)) {
            for (const [key, child] of Object.entries(properties)) {
                walk(child, `${path}.${key}`);
            }
        }
        walk(node["items"], `${path}[]`);
        for (const keyword of ["anyOf", "oneOf", "allOf"]) {
            const options = node[keyword];
            if (!Array.isArray(options)) continue;
            options.forEach((option, i) => walk(option, `${path}|${i}`));
        }
    };
    walk(json, "");
    return sites;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The JSDoc comments of a piece of declarations, as plain text, in order. */
function jsDocComments(dts: string): string[] {
    return [...dts.matchAll(/\/\*\*([\s\S]*?)\*\//g)].map((match) =>
        normalize(
            (match[1] ?? "")
                .split("\n")
                .map((line) => line.replace(/^\s*\*? ?/, ""))
                .join(" "),
        ),
    );
}

/**
 * The generated declarations of a schema: its type and its constant, which
 * `generate-types` writes one after the other.
 */
function declarationsOf(
    dtsPath: string,
    schemaName: string,
): { typeDoc: string; schemaDoc: string; typeBody: string } {
    const text = readFileSync(dtsPath, "utf8");
    const source = ts.createSourceFile(
        dtsPath,
        text,
        ts.ScriptTarget.Latest,
        true,
    );
    const statements = [...source.statements];
    const index = statements.findIndex(
        (statement) =>
            ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(
                (declaration) => declaration.name.getText() === schemaName,
            ),
    );
    const type = statements[index - 1];
    if (index < 1 || !type || !ts.isTypeAliasDeclaration(type)) {
        throw new Error(`${schemaName} has no type before it in ${dtsPath}`);
    }
    const leading = (node: ts.Node): string[] =>
        jsDocComments(
            (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [])
                .map((range) => text.slice(range.pos, range.end))
                .join("\n"),
        );
    return {
        typeDoc: leading(type).join(" "),
        schemaDoc: leading(statements[index] ?? type).join(" "),
        // Everything after `=`, comments of the first member included
        typeBody: text.slice(type.type.pos, type.type.end),
    };
}

/** Whitespace is not significant in JSDoc, and `*\/` has to be escaped there. */
function normalize(text: string): string {
    return text.replaceAll("*\\/", "*/").replaceAll(/\s+/g, " ").trim();
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

beforeAll(() => {
    if (!existsSync(join(DIST, "index.js"))) {
        throw new Error("dist is missing. Run `pnpm build` first.");
    }
});

describe("the helpers of this file", () => {
    it("see the descriptions of the schemas", () => {
        const schema = z
            .object({
                a: z.string().meta({ description: "field a" }),
                b: z
                    .array(
                        z.object({ c: z.number().meta({ description: "c" }) }),
                    )
                    .meta({ description: "field b" }),
            })
            .meta({ description: "root" });
        expect(allDescriptions(schema)).toEqual(
            new Set(["root", "field a", "field b", "c"]),
        );
    });

    it("list the description sites of a JSON Schema, parents first", () => {
        const schema = z
            .object({
                a: z.string().meta({ description: "field a" }),
                b: z
                    .array(
                        z
                            .union([
                                z.object({
                                    c: z.number().meta({ description: "c" }),
                                }),
                                z.string().meta({ description: "option" }),
                            ])
                            .meta({ description: "item" }),
                    )
                    .meta({ description: "field b" }),
            })
            .meta({ description: "root" });
        expect(
            descriptionSites(z.toJSONSchema(schema)).map(
                (site) => `${site.path} ${site.description}`,
            ),
        ).toEqual([
            ".a field a",
            ".b field b",
            ".b[] item",
            ".b[]|0.c c",
            ".b[]|1 option",
        ]);
    });

    it("read JSDoc blocks and JSON Schema descriptions", () => {
        expect(
            jsDocComments("/**\n * one\n * two *\\/ x\n */\ntype A = 1;"),
        ).toEqual(["one two */ x"]);
        expect(
            jsonSchemaDescriptions({
                description: "a",
                properties: { x: { description: "b" } },
            }),
        ).toEqual(new Set(["a", "b"]));
    });
});

describe.each(moduleNames)("built module %s", (moduleName) => {
    const source = sourceExports(moduleName);
    const sourceSchemas = schemaExports(source);

    it("exports the same names as the source", async () => {
        const built = await importBuilt(`${moduleName}.js`);
        expect(Object.keys(built).sort()).toEqual(Object.keys(source).sort());
    });

    it.each(sourceSchemas)(
        "%s keeps its descriptions in z.toJSONSchema()",
        async (name, sourceSchema) => {
            const built = (await importBuilt(`${moduleName}.js`))[name];
            expect(built).toBeInstanceOf(z.ZodType);
            if (!(built instanceof z.ZodType)) return;

            const jsonSchema = z.toJSONSchema(built, {
                io: "input",
                unrepresentable: "any",
            });

            // The root description
            const rootDescription = descriptionOf(sourceSchema);
            expect(rootDescription, `${name} has no description`).toBeTruthy();
            expect(jsonSchema.description).toBe(rootDescription);

            // Every description, wherever it is
            const present = jsonSchemaDescriptions(jsonSchema);
            for (const description of allDescriptions(sourceSchema)) {
                expect(present, `${name} lost: ${description}`).toContain(
                    description,
                );
            }

            // The built schema describes the very same places as the source
            expect(allDescriptions(built)).toEqual(
                allDescriptions(sourceSchema),
            );
            expect(descriptionSites(jsonSchema)).toEqual(
                descriptionSites(
                    z.toJSONSchema(sourceSchema, {
                        io: "input",
                        unrepresentable: "any",
                    }),
                ),
            );
        },
    );

    it.each(sourceSchemas)(
        "%s keeps its descriptions as JSDoc in the declarations",
        async (name, sourceSchema) => {
            const dtsPath = join(DIST, `${moduleName}.d.ts`);
            expect(existsSync(dtsPath), `${dtsPath} is missing`).toBe(true);
            const { typeDoc, schemaDoc, typeBody } = declarationsOf(
                dtsPath,
                name,
            );

            // The root: documented on the type and on the schema
            const root = normalize(descriptionOf(sourceSchema) ?? "");
            expect(root).not.toBe("");
            expect(typeDoc, `${name}: the type`).toBe(root);
            expect(schemaDoc, `${name}: the schema`).toBe(root);

            // Everything inside the type: the fields, the options of unions,
            // the items of arrays. As JSON Schema sees them, in the same order.
            const built = (await importBuilt(`${moduleName}.js`))[name];
            expect(built).toBeInstanceOf(z.ZodType);
            if (!(built instanceof z.ZodType)) return;
            const sites = descriptionSites(
                z.toJSONSchema(built, { io: "input", unrepresentable: "any" }),
            );
            expect(
                jsDocComments(typeBody),
                `${name}: the JSDoc inside the type, for ${sites.map((site) => site.path).join(" ")}`,
            ).toEqual(sites.map((site) => normalize(site.description)));
        },
    );
});

describe("the descriptions are prose", () => {
    it.each(moduleNames.map((name) => [name]))(
        "%s has no JSDoc tag leaking from a description",
        async (moduleName) => {
            const built = await importBuilt(`${moduleName}.js`);
            for (const [name, schema] of schemaExports(built)) {
                for (const description of allDescriptions(schema)) {
                    expect(
                        description,
                        `${name} has a tag in its description`,
                    ).not.toMatch(/^\s*@\w+/m);
                }
            }
        },
    );

    it("the JSDoc examples of the declarations do not use the removed `message` option", () => {
        const dts = readFileSync(join(DIST, "utils.d.ts"), "utf8");
        expect(dts).not.toMatch(/\{\s*message\s*:/);
    });
});

describe("the shipped files", () => {
    const shipped = readdirSync(DIST, { recursive: true })
        .map((file) => String(file).replaceAll("\\", "/"))
        .filter((file) => /\.(js|d\.ts)$/.test(file))
        .sort();

    it("are the entry points and the schema modules, nothing else", () => {
        const expected = ["index", "utils", "v0", ...moduleNames].flatMap(
            (name) => [`${name}.js`, `${name}.d.ts`],
        );
        expect(shipped).toEqual(expected.sort());
    });

    it("have a declaration for every module, and a module for every declaration", () => {
        const modules = (extension: string) =>
            shipped
                .filter((file) => file.endsWith(extension))
                .map((file) => file.slice(0, -extension.length));
        expect(modules(".d.ts")).toEqual(modules(".js"));
    });

    it("load no module for their side effects", () => {
        for (const file of shipped.filter((name) => name.endsWith(".js"))) {
            expect(
                readFileSync(join(DIST, file), "utf8"),
                `${file} has a bare import`,
            ).not.toMatch(/^import\s*["']/m);
        }
    });
});

describe("the public entry points", () => {
    const entries: Array<[string, { types: string; default: string }]> = [];
    for (const [subpath, target] of Object.entries(packageJson.exports)) {
        if (typeof target !== "string") entries.push([subpath, target]);
    }

    it("are explicit: no wildcard, no deep path", () => {
        expect(Object.keys(packageJson.exports).sort()).toEqual(
            [".", "./package.json", "./utils", "./v0"].sort(),
        );
    });

    it.each(entries)("%s has a runtime file and declarations", (_, target) => {
        expect(existsSync(join(ROOT, target.default))).toBe(true);
        expect(existsSync(join(ROOT, target.types))).toBe(true);
    });

    describe.each(entries)("%s", (subpath, target) => {
        const program = ts.createProgram([join(ROOT, target.types)], {
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
            strict: true,
            skipLibCheck: true,
            noEmit: true,
        });
        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(join(ROOT, target.types));

        /** The value exports of the declarations, by name. */
        function declaredValues(): Map<string, ts.Symbol> {
            const moduleSymbol = sourceFile
                ? checker.getSymbolAtLocation(sourceFile)
                : undefined;
            const values = new Map<string, ts.Symbol>();
            if (!moduleSymbol) return values;
            for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
                const target =
                    symbol.flags & ts.SymbolFlags.Alias
                        ? checker.getAliasedSymbol(symbol)
                        : symbol;
                if (target.flags & ts.SymbolFlags.Value) {
                    values.set(symbol.name, target);
                }
            }
            return values;
        }

        it("compiles without error", () => {
            const diagnostics = ts.getPreEmitDiagnostics(program);
            expect(
                diagnostics.map((d) =>
                    ts.flattenDiagnosticMessageText(d.messageText, "\n"),
                ),
            ).toEqual([]);
        });

        it("declares exactly what the runtime exports", async () => {
            const runtime = await importBuilt(
                target.default.replace(/^\.\/dist\//, ""),
            );
            expect([...declaredValues().keys()].sort()).toEqual(
                Object.keys(runtime).sort(),
            );
        });

        it("documents everything it exports, with the description of the schemas", async () => {
            const runtime = await importBuilt(
                target.default.replace(/^\.\/dist\//, ""),
            );
            for (const [name, symbol] of declaredValues()) {
                const documentation = normalize(
                    ts.displayPartsToString(
                        symbol.getDocumentationComment(checker),
                    ),
                );
                expect(
                    documentation,
                    `${subpath}: ${name} has no JSDoc`,
                ).not.toBe("");

                // A schema is documented by its description, whatever its name.
                // The default export is documented as what it is: the latest one.
                const value = runtime[name];
                const description =
                    value instanceof z.ZodType && name !== "default"
                        ? descriptionOf(value)
                        : undefined;
                if (description !== undefined) {
                    expect(documentation, `${subpath}: ${name}`).toBe(
                        normalize(description),
                    );
                }
            }
        });
    });

    it("./v0 exposes every schema of every module, RoleSchema included", async () => {
        const v0 = await importBuilt("v0.js");
        for (const moduleName of moduleNames) {
            for (const [name] of schemaExports(sourceExports(moduleName))) {
                expect(v0, `./v0 lacks ${name}`).toHaveProperty(name);
            }
        }
        expect(v0).toHaveProperty("RoleSchema");
        expect(v0).toHaveProperty("InstructionSchema");
    });

    it(". exposes the character schema of the latest version", async () => {
        const index = await importBuilt("index.js");
        const v0 = await importBuilt("v0.js");
        expect(index["CharacterV0Schema"]).toBe(v0["CharacterSchema"]);
        expect(index["default"]).toBe(index["CharacterV0Schema"]);
        expect(index["characterMap"]).toEqual({
            0: index["CharacterV0Schema"],
        });
    });
});

describe("the entry points resolve in a project which installed the package", () => {
    const resolutions = [
        ["node10", ts.ModuleResolutionKind.Node10, ts.ModuleKind.CommonJS],
        ["node16", ts.ModuleResolutionKind.Node16, ts.ModuleKind.Node16],
        ["nodenext", ts.ModuleResolutionKind.NodeNext, ts.ModuleKind.NodeNext],
        ["bundler", ts.ModuleResolutionKind.Bundler, ts.ModuleKind.ESNext],
    ] as const;
    const entryPoints = [
        ["@arisutalk/character-spec", "dist/index.d.ts"],
        ["@arisutalk/character-spec/v0", "dist/v0.d.ts"],
        ["@arisutalk/character-spec/utils", "dist/utils.d.ts"],
    ] as const;

    // What `pnpm add` installs: package.json and the published files
    let project = "";
    beforeAll(() => {
        project = mkdtempSync(join(tmpdir(), "character-spec-consumer-"));
        const installed = join(
            project,
            "node_modules/@arisutalk/character-spec",
        );
        mkdirSync(installed, { recursive: true });
        cpSync(join(ROOT, "package.json"), join(installed, "package.json"));
        cpSync(DIST, join(installed, "dist"), { recursive: true });
        writeFileSync(join(project, "package.json"), '{"type":"module"}');
    });
    afterAll(() => {
        rmSync(project, { recursive: true, force: true });
    });

    function resolveFrom(
        specifier: string,
        moduleResolution: ts.ModuleResolutionKind,
        module: ts.ModuleKind,
    ): string | undefined {
        // node10 has no import mode. Giving it one makes it read `exports`.
        const mode =
            moduleResolution === ts.ModuleResolutionKind.Node10
                ? undefined
                : ts.ModuleKind.ESNext;
        return ts
            .resolveModuleName(
                specifier,
                join(project, "app.ts"),
                { moduleResolution, module },
                ts.sys,
                undefined,
                undefined,
                mode,
            )
            .resolvedModule?.resolvedFileName.replaceAll("\\", "/");
    }

    describe.each(resolutions)("moduleResolution %s", (_, kind, module) => {
        it.each(entryPoints)("resolves %s", (specifier, file) => {
            const resolved = resolveFrom(specifier, kind, module);
            expect(
                resolved?.endsWith(
                    `/node_modules/@arisutalk/character-spec/${file}`,
                ),
            ).toBe(true);
        });
    });

    it.each(resolutions.filter(([name]) => name !== "node10"))(
        "moduleResolution %s does not resolve the removed deep paths",
        (_, kind, module) => {
            for (const removed of [
                "v0/Character/Message",
                "v0/Character/Assets",
                "v0/Instruction",
                "types/v0/index",
            ]) {
                expect(
                    resolveFrom(
                        `@arisutalk/character-spec/${removed}`,
                        kind,
                        module,
                    ),
                    removed,
                ).toBeUndefined();
            }
        },
    );
});
