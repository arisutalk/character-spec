# @arisutalk/character-spec ✨

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/arisutalk/character-spec)

Hi there! Welcome to the **character-spec** library for ArisuTalk! 🌸

This package defines the official character specification and schemas for ArisuTalk, strictly typed with [Zod](https://zod.dev/). It provides runtime validation and TypeScript types with **full JSDoc comments** for an amazing IDE experience!

It's super important to keep our waifus... I mean, characters, well-defined! (◕‿◕✿)

> [!WARNING]
> v0 is still in development and not yet finalized!

## 📦 Installation

Grab it with your favorite package manager!

```bash
pnpm add @arisutalk/character-spec zod
```

> [!NOTE]
> `zod` is a peer dependency! Don't forget it!* 😉

## 🚀 Usage

### Runtime Validation

Use the schemas to validate your character data at runtime. It's safe and sound! 🛡️

```typescript
import { CharacterV0Schema } from "@arisutalk/character-spec";
import type { CharacterV0 } from "@arisutalk/character-spec";

// Let's say you have some raw data...
const rawData = {
  specVersion: 0,
  id: "uuid-1234",
  name: "Aris",
  description: "Light Attribute AoE Dealer from Blue Archive.",
  avatarUrl: "https://example.com/aris.png",
  prompt: {
    system: "You are Aris from Blue Archive.",
    jailbreak: "",
  },
  lorebook: {
    config: { tokenLimit: 1000 },
    data: [],
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
};

// Validate it against the schema!
const aris = CharacterV0Schema.parse(rawData);

console.log(`Hello, ${aris.name}!`); // TypeScript knows 'name' exists! ✨
```

### TypeScript Types with JSDoc

Import types directly for type-only usage. **All types include JSDoc comments** extracted from schema metadata, giving you rich IDE tooltips! 💡

```typescript
import type { Character } from "@arisutalk/character-spec/v0/Character/Character";
import type { Chat } from "@arisutalk/character-spec/v0/Character/Chat";
import type { Message } from "@arisutalk/character-spec/v0/Character/Message";

// Hover over these in your IDE to see the JSDoc comments!
const character: Character = {
  // ... your character data
};
```

### Accessing Individual Schemas

You can also import individual schemas from their specific paths:

```typescript
import { CharacterSchema } from "@arisutalk/character-spec/v0/Character/Character";
import { ChatSchema } from "@arisutalk/character-spec/v0/Character/Chat";
import { MessageSchema } from "@arisutalk/character-spec/v0/Character/Message";
import { LorebookDataSchema } from "@arisutalk/character-spec/v0/Character/Lorebook";
```

## 📂 Structure

Everything is versioned so we don't break things!

- `v0/Character/`: Character-related schemas
  - `Character.ts`: The main character object with metadata
  - `Meta.ts`: Character metadata (author, license, version, etc.)
  - `Lorebook.ts`: World info and lore entries
  - `Chat.ts` & `Message.ts`: Chat history structures
  - `Assets.ts`: Character assets and avatar
- `v0/Executables/`: Script and hook definitions
  - `Executable.ts`: Script settings and runtime configuration
  - `ReplaceHook.ts`: Text replacement hooks for display/input/output
- `v0/utils.ts`: Utility schemas and helpers

## 🎨 Features

✨ **Runtime Validation**: Validate character data at runtime with Zod schemas  
� **Rich JSDoc**: All types include detailed JSDoc comments from schema metadata  
🔒 **Type Safety**: Full TypeScript support with inferred types  
🚀 **Tree-shakeable**: Import only what you need  
📦 **Zero Dependencies**: Only peer dependency is `zod`.

## �🛠️ Development

Want to contribute? Yay! Make sure to keep things clean. 🧹

```bash
# Install dependencies
pnpm install

# Build the library (compiles JS + generates types with JSDoc)
pnpm build

# Generate types only (with JSDoc from schema metadata)
pnpm generate-types

# Lint the code (Biome is fast! ⚡)
pnpm lint

# Format the code
pnpm format
```

### Type Generation

This package uses a custom type generation system powered by `zod-to-ts`. The build process:

1. Vite builds the JavaScript bundles
2. `generate-types.ts` script generates `.d.ts` files with JSDoc comments extracted from Zod's `.meta({ description })` values

This ensures that all JSDoc documentation from the schemas is preserved in the published types!

## 📄 License

Apache-2.0

Made with ❤️ for ArisuTalk.
