## Transport

We defined internal data structures for characters, and we need to make it into a file in order to export and share it.
This is the psuedocode for exporting a character:
```typescript

declare function toCBOR(data: any): Uint8Array;
declare async function compressData(input: Uint8Array): Promise<ArrayBuffer>

async function exportCharacter(character: Character): string {
    const cbor = toCBOR(character);
    const compressed = await compressData(cbor);
    return compressed;
}
```