/** Input payload passed to file-suggestion hook commands. */
export interface FileSuggestionCommandInput {
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode?: string
  agent_id?: string
  agent_type?: string
  /** The partial file path query string the user has typed. */
  query: string
}
