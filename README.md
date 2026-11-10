# @arisutalk/character-spec

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/arisutalk/character-spec)

The official character specification and schemas of ArisuTalk, strictly typed with [Zod](https://zod.dev/).
It provides runtime validation, and TypeScript types with **full JSDoc comments** for IDE autocomplete.

> [!WARNING]
> v0 is still in development and not yet finalized! Releases `0.0.x` may contain breaking changes, see the [changelog](./CHANGELOG.md).

## Installation

```bash
pnpm add @arisutalk/character-spec zod
```

> [!NOTE]
> `zod` is a peer dependency. Don't forget it!

## Public API

Only these entry points exist. Deep paths such as `@arisutalk/character-spec/v0/Character/Message` are not part of the package.

| Import path                       | What you get                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@arisutalk/character-spec`       | `CharacterV0Schema`, `characterMap` (version to schema), and the latest character schema (default) |
| `@arisutalk/character-spec/v0`    | Every schema, type, and helper of the v0 specification                                             |
| `@arisutalk/character-spec/utils` | `apply()`, which parses data with defaults filled                                                  |

The three entry points resolve under every `moduleResolution` of TypeScript: `node10` (`node`), `node16`, `nodenext` and `bundler`.

Everything of the specification is exported from `@arisutalk/character-spec/v0`:

- Character: `CharacterSchema`, `CharacterPromptDataSchema`, `MetaSchema`
- Lorebook: `LorebookDataSchema`, `LorebookEntrySchema`, `LorebookConditionSchema`
- Chat: `ChatSchema`, `MessageSchema`, `RoleSchema`
- Assets: `AssetEntitySchema`, `AssetsSettingSchema`
- Instruction: `InstructionSchema`
- Executables: `ScriptSettingSchema`, `ReplaceHookSchema`, `ReplaceHookEntitySchema`, `ReplaceHookMetaSchema`
- Utilities: `FileSchema`, `ImageURLSchema`, `Uint8ArraySchema`, `positiveIntegerSchema`, `unique`, `uniqueIdArray`

Every `FooSchema` comes with a `Foo` type, which is the same as `z.infer<typeof FooSchema>`.
`Uint8ArraySchema`, `FileSchema` and `ImageURLSchema` come with `Uint8ArrayType`, `FileType` and `ImageURL`.

## Usage

### Runtime Validation

```typescript
import { CharacterSchema } from "@arisutalk/character-spec/v0";

// Let's say you have some raw data...
const rawData = {
    specVersion: 0,
    id: "uuid-1234",
    name: "Aris",
    description: "Light Attribute AoE Dealer from Blue Archive.",
    avatarUrl: "https://example.com/aris.png", // an image URL, same as the `data` of an asset
    prompt: {
        description: "You are Aris from Blue Archive.",
        authorsNote: "Keep replies short.",
        lorebook: {
            config: { tokenLimit: 1000 },
            data: [],
        },
    },
    executables: {
        runtimeSetting: {},
        replaceHooks: {
            display: [],
            input: [],
            output: [],
            request: [],
        },
    },
    metadata: {
        author: "concertypin",
        license: "CC-BY-4.0",
    },
    assets: {
        assets: [
            {
                id: "avatar",
                mimeType: "image/png",
                name: "aris.png",
                data: "https://example.com/aris.png",
            },
        ],
    },
};

// Validate it against the schema. Defaults are filled.
const aris = CharacterSchema.parse(rawData);

console.log(`Hello, ${aris.name}!`); // TypeScript knows 'name' exists!
```

The root entry point exposes the same schema for the latest spec version, which is handy when you only need the character:

```typescript
import latest, {
    CharacterV0Schema,
    characterMap,
} from "@arisutalk/character-spec";
import type { CharacterV0 } from "@arisutalk/character-spec";

latest === CharacterV0Schema; // true
characterMap[0] === CharacterV0Schema; // true
```

Use `apply()` when you don't want to pass the fields that have defaults:

```typescript
import { MessageSchema } from "@arisutalk/character-spec/v0";
import { apply } from "@arisutalk/character-spec/utils";

const message = apply(MessageSchema, {
    id: "1",
    chatId: "chat1",
    role: "user",
    content: { type: "text", data: "hello" },
});
// message.timestamp and message.inlays are filled
```

### TypeScript Types with JSDoc

**All types include JSDoc comments** extracted from the schemas' `.meta({ description })`, giving you rich IDE tooltips.

```typescript
import type { Character, Chat, Message } from "@arisutalk/character-spec/v0";

// Hover over these in your IDE to see the JSDoc comments!
const character: Character = {
    // ... your character data
};
```

### JSON Schema

The descriptions are also part of the runtime schemas, so Zod can turn them into a JSON Schema that carries them:

```typescript
import * as z from "zod";
import { CharacterSchema } from "@arisutalk/character-spec/v0";

// `Uint8Array` data has no JSON representation, hence `unrepresentable: "any"`.
const jsonSchema = z.toJSONSchema(CharacterSchema, {
    io: "input",
    unrepresentable: "any",
});
```

### Files

Binary data is a `Uint8Array`, never a base64 string. A file is either an URL, or a `Uint8Array`.
Assets are keyed by their `id`, and so are message inlays. See [docs/terms.md](./docs/terms.md) for assets, `local:` URLs and inlays.

## Structure

Everything is versioned so we don't break things!

- `src/types/v0/Character/`: `Character.ts` (the character), `Meta.ts` (author, license, version...), `Lorebook.ts` (lore entries and their conditions)
- `src/types/v0/Assets/`: character assets, and inlays
- `src/types/v0/Chat/`: chat sessions
- `src/types/v0/Message/`: messages, and their roles
- `src/types/v0/Instruction/`: instructions which guide the AI
- `src/types/v0/Executables/`: script settings and replace hooks
- `src/types/v0/utils.ts`: utility schemas and helpers

See [TRANSPORT.md](./TRANSPORT.md) for how characters are exported and imported.

## Features

- **Runtime Validation**: validate data with Zod schemas
- **Rich JSDoc**: types and runtime schemas carry the descriptions of the schemas
- **Type Safety**: full TypeScript support with inferred types
- **Tree-shakeable**: import only what you need
- **Zero Dependencies**: the only peer dependency is `zod`

## Development

Want to contribute? Yay! Make sure to keep things clean.

```bash
# Install dependencies
pnpm install

# Build the library: compiles the JS, then generates the types with JSDoc
pnpm build

# Build, then run the type tests and the unit tests
pnpm test

# Lint the code (oxlint)
pnpm lint

# Format the code (oxfmt)
pnpm format
```

### Lint and commit without a build

`pnpm lint` and the pre-commit hook (`pnpm format && pnpm lint:fix`) work on a fresh clone, they do not need `dist`. The two files which import the built declarations, `tests/type-details.test.ts` and `scripts/type-test.ts`, are linted without type information (`pnpm lint:untyped`), and type-checked by `pnpm test:types` (`tsc -p tsconfig.dist.json`), which `pnpm test` runs after the build. Do not run two builds at the same time: they share `dist`, and a build that races another one can fail halfway and leave `dist` broken.

### Type Generation

The declarations are generated from the schemas, by `scripts/generate-types.ts` (powered by `zod-to-ts`). The build:

1. `vite build` builds the JavaScript, and emits intermediate declarations with `tsc`
2. `scripts/generate-types.ts` generates the `.d.ts` files into `dist`: the plain types with JSDoc extracted from `.meta({ description })`, and the schema declarations

This ensures that the descriptions of the schemas are in both the runtime schemas and the published types. The tests of `tests/built-output.test.ts` check it against the built package.

## License

Apache-2.0

Made with love for ArisuTalk.
