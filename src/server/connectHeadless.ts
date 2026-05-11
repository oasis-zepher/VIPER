/**
 * Headless RCS connector — connects to a remote-control server in pipe mode.
 *
 * Used when `-p` or `--print` is passed alongside a cc:// URL. The connection
 * runs without an interactive REPL. Stubbed when BRIDGE_MODE is disabled.
 */
export const runConnectHeadless: (..._args: unknown[]) => Promise<void> = () =>
  Promise.resolve()
