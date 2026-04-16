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

export const glmCapabilities: ProviderCapabilities = {
  promptCaching: false,
  streaming: true,
  thinking: false,
  betasInExtraBody: false,
  toolSearch: false,
  clientRequestId: false,
}

export class GLMAdapter implements ProviderAdapter {
  readonly name = 'glm'
  readonly capabilities = glmCapabilities

  async *queryStreaming(
    params: QueryParams,
  ): AsyncGenerator<
    StreamEvent | AssistantMessage | SystemAPIErrorMessage,
    void
  > {
    const { normalizeMessagesForAPI } = await import('../../../utils/messages.js')
    const messagesForAPI = normalizeMessagesForAPI(params.messages, params.tools)
    const { queryModelGLM } = await import('../glm/index.js')
    yield* queryModelGLM(
      messagesForAPI,
      params.systemPrompt,
      params.tools,
      params.signal,
      params.options,
    )
  }

  async query(_params: QueryParams): Promise<BetaMessage> {
    throw new Error('GLMAdapter does not support non-streaming query')
  }

  isAvailable(): boolean {
    return !!(process.env.GLM_API_KEY || process.env.GLM_BASE_URL)
  }
}
