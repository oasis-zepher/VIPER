// Canonical core engine entrypoint.
//
// The implementation is still hosted in src/ during this extraction stage so
// existing feature gates, host state, and build-time macros keep their current
// behavior. Consumers should import from this package instead of private src/*
// paths so the implementation can move behind this boundary without touching
// call sites again.

export { query } from '../../../src/query.js'
export type { QueryParams } from '../../../src/query.js'

export { QueryEngine, ask } from '../../../src/QueryEngine.js'
export type { QueryEngineConfig } from '../../../src/QueryEngine.js'

export type { QueryDeps } from '../../../src/query/deps.js'
export type {
  Terminal as QueryTerminal,
  Continue as QueryContinueReason,
} from '../../../src/query/transitions.js'
