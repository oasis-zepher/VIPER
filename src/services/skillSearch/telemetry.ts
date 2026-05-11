/**
 * Telemetry logger for remote skill loads.
 *
 * Records metadata about each remote-skill fetch for observability.
 * No-op when skill-search telemetry is not configured.
 */
export function logRemoteSkillLoaded(_data: {
  slug: string
  cacheHit: boolean
  latencyMs: number
  urlScheme: string
  error?: string
  fileCount?: number
  totalBytes?: number
  fetchMethod?: string
}): void {}
