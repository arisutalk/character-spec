/**
 * @fileoverview Type testing utilities
 */

/**
 * Bidirectional check, except Uint8Array
 */
export type Equals<A, B> = A extends Uint8Array<ArrayBuffer | ArrayBufferLike>
    ? B extends Uint8Array<ArrayBuffer | ArrayBufferLike>
        ? true
        : false
    : StrictlyEquals<A, B>;
/**
 * Checks if two types are exactly equal.
 * @template A The first type to compare.
 * @template B The second type to compare.
 * Returns true if A and B are the same type, false otherwise.
 */
export type StrictlyEquals<A, B> = (<T>() => T extends A ? 1 : 2) extends <
    T,
>() => T extends B ? 1 : 2
    ? true
    : false;

/**
 * Expect<T> - Compiles only if T is true.
 * Use with Equals to assert type equality.
 */
export type Expect<T extends true> = T;

/**
 * ExpectExtends<A, B> - Checks if A extends B
 */
export type ExpectExtends<A, B> = A extends B ? true : false;
