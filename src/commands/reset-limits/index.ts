/** Reset-limits command — clears rate-limit state. Feature-gated behind DAEMON. */
const stub = { isEnabled: () => false, isHidden: true, name: 'stub' }

export const resetLimits = stub
export const resetLimitsNonInteractive = stub
