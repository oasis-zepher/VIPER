import { feature } from 'bun:bundle'

export type EventSamplingConfig = {
  [eventName: string]: {
    sample_rate: number
  }
}

export type GrowthBookExperimentData = {
  experimentId: string
  variationId: number
  userAttributes?: unknown
  experimentMetadata?: Record<string, unknown>
}

type EventMetadata = Record<string, number | boolean | undefined>
type FirstPartyImpl = typeof import('./firstPartyEventLogger.impl.js')

const impl: FirstPartyImpl | null = feature('OBSERVABILITY')
  ? (require('./firstPartyEventLogger.impl.js') as FirstPartyImpl)
  : null

export function getEventSamplingConfig(): EventSamplingConfig {
  return impl?.getEventSamplingConfig() ?? {}
}

export function shouldSampleEvent(eventName: string): number | null {
  return impl?.shouldSampleEvent(eventName) ?? null
}

export async function shutdown1PEventLogging(): Promise<void> {
  await impl?.shutdown1PEventLogging()
}

export function is1PEventLoggingEnabled(): boolean {
  return impl?.is1PEventLoggingEnabled() ?? false
}

export function logEventTo1P(
  eventName: string,
  metadata: EventMetadata = {},
): void {
  impl?.logEventTo1P(eventName, metadata)
}

export function logGrowthBookExperimentTo1P(
  data: GrowthBookExperimentData,
): void {
  impl?.logGrowthBookExperimentTo1P(data as never)
}

export function initialize1PEventLogging(): void {
  impl?.initialize1PEventLogging()
}

export async function reinitialize1PEventLoggingIfConfigChanged(): Promise<void> {
  await impl?.reinitialize1PEventLoggingIfConfigChanged()
}
