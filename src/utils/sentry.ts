import { feature } from 'bun:bundle'

type SentryImpl = typeof import('./sentry.impl.js')

const impl: SentryImpl | null = feature('OBSERVABILITY')
  ? (require('./sentry.impl.js') as SentryImpl)
  : null

export function initSentry(): void {
  impl?.initSentry()
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  impl?.captureException(error, context)
}

export function setTag(key: string, value: string): void {
  impl?.setTag(key, value)
}

export function setUser(user: {
  id?: string
  email?: string
  username?: string
}): void {
  impl?.setUser(user)
}

export async function closeSentry(timeoutMs = 2000): Promise<void> {
  await impl?.closeSentry(timeoutMs)
}

export function isSentryInitialized(): boolean {
  return impl?.isSentryInitialized() ?? false
}
