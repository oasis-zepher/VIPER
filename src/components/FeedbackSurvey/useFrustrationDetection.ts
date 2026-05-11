/**
 * Frustration-detection hook.
 *
 * Monitors conversation state for signs of user frustration and surfaces
 * a feedback survey when triggered. Returns closed state when disabled.
 */
export function useFrustrationDetection(
  _messages: unknown[],
  _isLoading: boolean,
  _hasActivePrompt: boolean,
  _otherSurveyOpen: boolean,
): {
  state: 'closed' | 'open'
  handleTranscriptSelect: () => void
} {
  return { state: 'closed', handleTranscriptSelect: () => {} }
}
