## Transport

We defined internal data structures for characters, and we need to make them into a file in order to export and share them.

This is the pseudocode for exporting and importing a character:

```typescript
import { CharacterSchema, type Character } from "@arisutalk/character-spec/v0";

declare function toCBOR(data: unknown): Uint8Array;
declare function fromCBOR(data: Uint8Array): unknown;
declare function compress(input: Uint8Array): Promise<Uint8Array>;
declare function decompress(input: Uint8Array): Promise<Uint8Array>;

async function exportCharacter(character: Character): Promise<Uint8Array> {
    // `Uint8Array` data is stored as is by CBOR, there is no base64 bloat.
    const cbor = toCBOR(character);
    return await compress(cbor);
}

async function importCharacter(file: Uint8Array): Promise<Character> {
    const cbor = await decompress(file);
    // Never trust a file: validate it, and fill the defaults.
    return CharacterSchema.parse(fromCBOR(cbor));
}
```

Assets (`character.assets`) are either an URL or a `Uint8Array`, and an exported character is expected to carry the files of its assets as `Uint8Array`.
Importing a character is the time to move those files to the storage of the client and refer to them with `local:` URLs, so the character stays light. `data:` URLs must not be used, as they bloat the character.
See [docs/terms.md](./docs/terms.md) for the details of assets, `Uint8Array`, `local:` URLs and inlays.

Keep in mind that Chat and Message are not included in the character data, in order to keep the character data size small and message history can be queried from the database.
Inlays belong to messages, so they are not exported with the character either.
