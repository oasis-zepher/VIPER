/**
 * Deep-immutable marker type.
 *
 * NOTE: Currently an identity type (no-op) to maintain compatibility with the
 * decompiled codebase. Making this a true recursive readonly mapped type would
 * break hundreds of call sites that pass DeepImmutable-wrapped objects to
 * functions expecting mutable types. Keep as identity until callers are
 * refactored to accept readonly variants.
 */
export type DeepImmutable<T> = T

/** Represents an array whose elements are drawn from T. */
export type Permutations<T> = T[]
