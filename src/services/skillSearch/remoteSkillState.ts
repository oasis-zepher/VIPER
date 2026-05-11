/**
 * Remote-skill discovery helpers.
 *
 * These operate on skill slugs to strip canonical marketplace prefixes and
 * look up previously-discovered remote skills. Stubbed when skill-search
 * is disabled — no remote skills are ever discovered.
 */

/** Strip a marketplace canonical prefix from a skill slug, if present. */
export function stripCanonicalPrefix(_name: string): string | null {
  return null
}

/** Look up a previously-discovered remote skill by slug. */
export function getDiscoveredRemoteSkill(
  _slug: string,
): { url: string } | undefined {
  return undefined
}
