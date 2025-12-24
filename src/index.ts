import {
    type Character as CharacterV0,
    CharacterSchema as CharacterV0Schema,
} from "@/types/v0/Character/Character";

/**
 * Version-schema pair of character specification
 */
export const characterMap = {
    0: CharacterV0Schema,
} as const;
/**
 * Version-type pair of character specification
 */
export type CharacterMap = {
    "0": CharacterV0;
};
/**
 * Latest character specification
 */
export default characterMap["0"];
