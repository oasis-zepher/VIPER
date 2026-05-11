/**
 * Local skill-index cache invalidation.
 *
 * Clears the memoized skill index so the next search rebuilds from disk.
 * No-op when the skill-search feature is disabled.
 */
export const clearSkillIndexCache: () => void = () => {}
