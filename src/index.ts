import {
    type Character as CharacterV0,
    CharacterSchema as CharacterV0Schema,
} from "@/types/v0/Character/Character";

export const characterMap = {
    0: CharacterV0Schema,
} as const;
export type CharacterMap = {
    "0": CharacterV0;
};

export default characterMap;
