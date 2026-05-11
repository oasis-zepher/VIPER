export type ConnectorTextBlock = {
  type: string
  connector_text: string
  signature?: string
  [key: string]: unknown
}

export type ConnectorTextDelta = {
  type: string
  connector_text: string
  text?: string
  thinking?: string
  signature?: string
  [key: string]: unknown
}

export const isConnectorTextBlock = (
  block: unknown,
): block is ConnectorTextBlock =>
  typeof block === 'object' &&
  block !== null &&
  'connector_text' in block &&
  typeof (block as Record<string, unknown>).connector_text === 'string'
