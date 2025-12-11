# @arisutalk/character-spec ✨

Hi there! Welcome to the **character-spec** library for ArisuTalk! 🌸
This package defines the official character specification, schemas, and providing migration tools strictly typed with [Valibot](https://valibot.dev/).

It's super important to keep our waifus... I mean, characters, well-defined! (◕‿◕✿)
v0 is still in development, it's not even finished!

## 📦 Installation

Grab it with your favorite package manager!

```bash
pnpm add @arisutalk/character-spec valibot
```
*Note: `valibot` is a peer dependency! Don't forget it!* 😉

## 🚀 Usage

Here is how you can use the schemas to validate your character data. It's safe and sound! 🛡️

```typescript
import { CharacterSchema, type Character } from "@arisutalk/character-spec/v0";
import * as v from "valibot";

// Let's say you have some raw data...
const rawData: Character = {
  specVersion: 0,
  id: "uuid-1234",
  name: "Aris",
  description: "Light Attribute AoE Dealer from Blue Archive.",
  prompt: {} as any // Just for example, you should fill it with valid data!
};

// Validate it against v0 Schema!
const AL_1S = v.parse(CharacterSchema, rawData);

console.log(`Hello, ${AL_1S.name}!`); // Typescript knows 'name' exists! ✨
```

## 📂 Structure

Everything is versioned so we don't break things!
- `src/types/v0/`: Contains the initial Version 0 specs.
  - `Character.ts`: The main character object.
  - `Lorebook.ts`: World info and lore.
  - `Chat.ts` & `Message.ts`: Chat history structures.

## 🛠️ Development

Want to contribute? Yay! Make sure to keep things clean. 🧹

```bash
# Build the library
pnpm build

# Lint the code (Biome is fast! ⚡)
pnpm lint

# Format the code
pnpm format
```

Made with ❤️ for ArisuTalk.
