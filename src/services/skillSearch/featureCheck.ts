/**
 * Skill-search feature gate.
 *
 * Skill search discovers and loads remote skills from configured marketplaces.
 * When the EXPERIMENTAL_SKILL_SEARCH feature flag is off, this stub returns
 * false and the skill-search subsystem is never booted.
 */
export const isSkillSearchEnabled: () => boolean = () => false
