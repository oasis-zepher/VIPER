/** Clears memoized attribution caches (called on logout/config change). */
export const clearAttributionCaches: () => void = () => {}

/** Evicts the file-content cache used by attribution. */
export const sweepFileContentCache: () => void = () => {}

/** Registers git hooks for commit attribution. No-op when attribution is disabled. */
export const registerAttributionHooks: () => void = () => {}
