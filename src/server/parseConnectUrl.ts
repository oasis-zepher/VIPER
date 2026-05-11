/**
 * Parse a cc:// or cc+unix:// connect URL into its server URL and auth token.
 *
 * Format:
 *   cc://host:port?token=JWT    → ws://host:port, authToken=JWT
 *   cc+unix:///path?token=JWT   → unix:///path, authToken=JWT
 *
 * Used by the CLI entry point to detect a pending bridge connection from argv.
 */
export const parseConnectUrl: (
  _url: string,
) => {
  serverUrl: string
  authToken: string
  [key: string]: unknown
} = () => ({ serverUrl: '', authToken: '' })
