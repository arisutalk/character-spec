# Changelog

## 0.0.18

### Breaking changes

- **The deep import paths are gone.** `exports` of `package.json` no longer has a `./*` wildcard. Only `@arisutalk/character-spec`, `@arisutalk/character-spec/v0` and `@arisutalk/character-spec/utils` can be imported. Migrate imports such as:
    - `@arisutalk/character-spec/v0/Character` (barrel), `.../v0/Character/Message`, `.../v0/Character/Assets`, `.../types/v0/index` to `@arisutalk/character-spec/v0`
    - `@arisutalk/character-spec/v0/Instruction` to `@arisutalk/character-spec/v0`
    - `@arisutalk/character-spec/utils` is unchanged
- `positiveInteger` is renamed `positiveIntegerSchema`: every schema export ends with `Schema`, and the linter enforces it (`zod/consistent-schema-var-name`). Its type is `PositiveInteger`.
- Message inlays must be unique by `id`, not by `name` anymore. Two inlays with the same `name` but different `id` are valid now, two inlays with the same `id` are not.
- `AssetEntity.id` is trimmed. `" asset-1 "` becomes `"asset-1"`, and ids are compared after trimming, so `"a"` and `" a "` are duplicates.
- The source modules moved, which only matters if you built the package from source: `Character/Assets`, `Character/Chat` and `Character/Message` are now `Assets/Assets`, `Chat/Chat` and `Message/Message`.
- The declarations of the default export of the root entry point describe what it is: the latest character schema (it used to declare the `characterMap`, while the runtime exported the schema).

### Added

- `InstructionSchema` and `Instruction` are restored (`@arisutalk/character-spec/v0`). Their conditions are the lorebook conditions, so `custom` is supported.
- `CharacterV0Schema` and the `CharacterV0` type are exported by the root entry point, at runtime too. The declarations used to declare `CharacterV0Schema` while the runtime did not export it.
- `RoleSchema` is exported publicly.
- `uniqueIdArray()` helper, which builds an array schema with unique `id`s that defaults to `[]`. Assets, inlays and lorebook entries use it, so they are validated the same way.
- Descriptions for the `custom` lorebook condition, `LorebookConditionSchema` and `ReplaceHookEntitySchema`.
- `@types/node` as a dev dependency (the tests read the build output).

### Changed

- The description of `avatarUrl` tells it is an image URL, which can be the `data` of an entry in `assets` (it is not an asset `id`).
- The description of `FileSchema` no longer carries a stray `@type` tag.
- Replace the `message` option of `refine()` by `error` (Zod 4).
- `import * as z from "zod"` everywhere.
- The `condition` and `data` arrays of lorebooks and replace hooks have the same `.default([])` order everywhere.

### Fixed

- The generated `utils.d.ts` swallowed the declarations of `unique` and `positiveIntegerSchema`, and left broken comments behind. Every runtime export has a declaration now, and `pnpm generate-types` fails if one does not.
- The runtime and the declarations of every entry point export the same names, and the declarations carry JSDoc for all of them. Tests check it.
- Descriptions survive the build, both in the runtime schemas (`z.toJSONSchema()` has them) and as JSDoc in the declarations. Tests check it against the built package.
- The declarations carry every description, not only the ones of object fields: the options of unions (`LorebookCondition`, message content, `string | Uint8Array`...), the items of arrays and every exported schema are documented too. Tests compare the JSDoc of each type, place by place, with the descriptions of `z.toJSONSchema()`.
- The declarations resolve under every `moduleResolution`: relative imports have explicit `.js` extensions.
- `@arisutalk/character-spec/v0` and `/utils` resolve under `moduleResolution: node10` (`node`) too, through `typesVersions`. They used to fail with TS2307 there. Tests resolve every entry point under node10, node16, nodenext and bundler in a project which installed the package.
- Intermediate files (`dist/types`, `.d.ts.map`) are no longer published.
- The barrels of the folders (`dist/v0/Character.js`, ...) are no longer built, and `dist/v0.js` no longer imports them for side effects. `dist/v0.d.ts` re-exports the schema modules directly, so every shipped `.d.ts` has a `.js` beside it. Tests check the list of shipped files.

### Tooling

- Biome is replaced by oxlint and oxfmt. `tsconfig` is split into `main`, `test` and `node` projects.
- oxlint runs all the recommended rules of `eslint-plugin-zod`, but `zod/prefer-string-schema-with-trim`: it would trim every string of the spec, message text, prompts and replace hook outputs included. It is off until the owner decides, the reason is in `scripts/linter/zod.ts`.
- `pnpm lint` and the pre-commit hook work on a fresh clone, without a build. The two files which import `dist` are type-checked by `pnpm test:types` (`tsconfig.dist.json`), and linted without type information by `pnpm lint:untyped`.
- `pnpm test` builds first, then runs the type tests and the unit tests.
- Tests cover the custom lorebook condition, inlay uniqueness, id trimming, instructions, the generated types and the built package.
- `vite-tsconfig-paths` is replaced by the native `resolve.tsconfigPaths` of Vite.
