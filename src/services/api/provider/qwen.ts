import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {
  AssistantMessage,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../../types/message.js'
import type {
  ProviderAdapter,
  ProviderCapabilities,
  QueryParams,
} from './types.js'

export const qwenCapabilities: ProviderCapabilities = {
  promptCaching: false,
  streaming: true,
  thinking: false,
  betasInExtraBody: false,
  toolSearch: false,
  clientRequestId: false,
}

export class QwenAdapter implements ProviderAdapter {
  readonly name = 'qwen'
  readonly capabilities = qwenCapabilities

  async *queryStreaming(
    params: QueryParams,
  ): AsyncGenerator<
    StreamEvent | AssistantMessage | SystemAPIErrorMessage,
    void
  > {
    const { normalizeMessagesForAPI } = await import('../../../utils/messages.js')
    const messagesForAPI = normalizeMessagesForAPI(params.messages, params.tools)
    const { queryModelQwen } = await import('../qwen/index.js')
    yield* queryModelQwen(
      messagesForAPI,
      params.systemPrompt,
      params.tools,
      params.signal,
      params.options,
    )
  }

  async query(_params: QueryParams): Promise<BetaMessage> {
    throw new Error('QwenAdapter does not support non-streaming query')
  }

  isAvailable(): boolean {
    return !!(process.env.QWEN_API_KEY || process.env.QWEN_BASE_URL)
  }
}
