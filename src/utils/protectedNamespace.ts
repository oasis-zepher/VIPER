/**
 * Check whether the current session is operating in a protected namespace
 * (e.g., a sandboxed environment where certain operations should be disallowed).
 * Returns false when the check is not available.
 */
export const checkProtectedNamespace: () => boolean = () => false
