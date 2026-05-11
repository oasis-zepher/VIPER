/** Entry point for the self-hosted runner (BYOC). Runs a CLI session in a container. */
export const selfHostedRunnerMain: (_args: string[]) => Promise<void> = () =>
  Promise.resolve()
