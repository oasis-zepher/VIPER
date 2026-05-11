/**
 * Remote-skill loader.
 *
 * Downloads and caches a skill from a remote marketplace URL. Returns
 * metadata about the fetch (cache hit, latency, content, size).
 * Stubbed when skill-search is disabled — no remote skills are fetched.
 */
export function loadRemoteSkill(
  _slug: string,
  _url: string,
): Promise<{
  cacheHit: boolean
  latencyMs: number
  skillPath: string
  content: string
  fileCount?: number
  totalBytes?: number
  fetchMethod?: string
}> {
  return Promise.resolve({
    cacheHit: false,
    latencyMs: 0,
    skillPath: '',
    content: '',
  })
}
