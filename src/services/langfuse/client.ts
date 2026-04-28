import { feature } from 'bun:bundle'

type ClientImpl = typeof import('./client.impl.js')

const impl: ClientImpl | null = feature('OBSERVABILITY')
  ? (require('./client.impl.js') as ClientImpl)
  : null

export function isLangfuseEnabled(): boolean {
  return impl?.isLangfuseEnabled() ?? false
}

export function getLangfuseProcessor(): unknown | null {
  return impl?.getLangfuseProcessor() ?? null
}

export function initLangfuse(): boolean {
  return impl?.initLangfuse() ?? false
}

export async function shutdownLangfuse(): Promise<void> {
  await impl?.shutdownLangfuse()
}
