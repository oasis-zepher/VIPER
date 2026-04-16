import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { randomUUID } from 'crypto'
import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../../types/message.js'
import type { Tools } from '../../../Tool.js'
import { addToTotalSessionCost } from '../../../cost-tracker.js'
import type { Options } from '../claude.js'
import { anthropicMessagesToOpenAI } from '../openai/convertMessages.js'
import {
  anthropicToolChoiceToOpenAI,
  anthropicToolsToOpenAI,
} from '../openai/convertTools.js'
import { adaptOpenAIStreamToAnthropic } from '../openai/streamAdapter.js'
import { calculateUSDCost } from '../../../utils/modelCost.js'
import { toolToAPISchema } from '../../../utils/api.js'
import { logForDebugging } from '../../../utils/debug.js'
import {
  createAssistantAPIErrorMessage,
  normalizeContentFromAPI,
  normalizeMessagesForAPI,
} from '../../../utils/messages.js'
import type { SystemPrompt } from '../../../utils/systemPromptType.js'
import { getGLMClient } from './client.js'
import { resolveGLMModel } from './modelMapping.js'
import {
  clearProviderClientCache,
  clearProviderSessionConfig,
  getProviderAuthFailureMessage,
  isLikelyProviderAuthError,
} from '../../../utils/providerSessionConfig.js'

export async function* queryModelGLM(
  messages: Message[],
  systemPrompt: SystemPrompt,
  tools: Tools,
  signal: AbortSignal,
  options: Options,
): AsyncGenerator<
  StreamEvent | AssistantMessage | SystemAPIErrorMessage,
  void
> {
  try {
    const glmModel = resolveGLMModel(options.model)
    const messagesForAPI = normalizeMessagesForAPI(messages, tools)

    const toolSchemas = await Promise.all(
      tools.map(tool =>
        toolToAPISchema(tool, {
          getToolPermissionContext: options.getToolPermissionContext,
          tools,
          agents: options.agents,
          allowedAgentTypes: options.allowedAgentTypes,
          model: options.model,
        }),
      ),
    )
    const standardTools = toolSchemas.filter(
      (t): t is BetaToolUnion & { type: string } => {
        const anyT = t as Record<string, unknown>
        return anyT.type !== 'advisor_20260301' && anyT.type !== 'computer_20250124'
      },
    )

    const openaiMessages = anthropicMessagesToOpenAI(messagesForAPI, systemPrompt)
    const openaiTools = anthropicToolsToOpenAI(standardTools)
    const openaiToolChoice = anthropicToolChoiceToOpenAI(options.toolChoice)
    const client = getGLMClient({
      maxRetries: 0,
      fetchOverride: options.fetchOverride,
      source: options.querySource,
    })

    logForDebugging(
      `[GLM] Calling model=${glmModel}, messages=${openaiMessages.length}, tools=${openaiTools.length}`,
    )

    const stream = await client.chat.completions.create(
      {
        model: glmModel,
        messages: openaiMessages,
        ...(openaiTools.length > 0 && {
          tools: openaiTools,
          ...(openaiToolChoice && { tool_choice: openaiToolChoice }),
        }),
        stream: true,
        stream_options: { include_usage: true },
        ...(options.temperatureOverride !== undefined && {
          temperature: options.temperatureOverride,
        }),
      },
      { signal },
    )

    const adaptedStream = adaptOpenAIStreamToAnthropic(stream, glmModel)
    const contentBlocks: Record<number, any> = {}
    let partialMessage: any = undefined
    let usage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    }
    let ttftMs = 0
    const start = Date.now()

    for await (const event of adaptedStream) {
      switch (event.type) {
        case 'message_start': {
          partialMessage = (event as any).message
          ttftMs = Date.now() - start
          if ((event as any).message?.usage) {
            usage = { ...usage, ...((event as any).message.usage) }
          }
          break
        }
        case 'content_block_start': {
          const idx = (event as any).index
          const cb = (event as any).content_block
          if (cb.type === 'tool_use') {
            contentBlocks[idx] = { ...cb, input: '' }
          } else if (cb.type === 'text') {
            contentBlocks[idx] = { ...cb, text: '' }
          } else if (cb.type === 'thinking') {
            contentBlocks[idx] = { ...cb, thinking: '', signature: '' }
          } else {
            contentBlocks[idx] = { ...cb }
          }
          break
        }
        case 'content_block_delta': {
          const idx = (event as any).index
          const delta = (event as any).delta
          const block = contentBlocks[idx]
          if (!block) break
          if (delta.type === 'text_delta') {
            block.text = (block.text || '') + delta.text
          } else if (delta.type === 'input_json_delta') {
            block.input = (block.input || '') + delta.partial_json
          } else if (delta.type === 'thinking_delta') {
            block.thinking = (block.thinking || '') + delta.thinking
          } else if (delta.type === 'signature_delta') {
            block.signature = delta.signature
          }
          break
        }
        case 'content_block_stop': {
          const idx = (event as any).index
          const block = contentBlocks[idx]
          if (!block || !partialMessage) break
          const m: AssistantMessage = {
            message: {
              ...partialMessage,
              content: normalizeContentFromAPI([block], tools, options.agentId),
            },
            requestId: undefined,
            type: 'assistant',
            uuid: randomUUID(),
            timestamp: new Date().toISOString(),
          }
          yield m
          break
        }
        case 'message_delta': {
          const deltaUsage = (event as any).usage
          if (deltaUsage) {
            usage = { ...usage, ...deltaUsage }
          }
          break
        }
        case 'message_stop':
          break
      }

      if (event.type === 'message_stop' && usage.input_tokens + usage.output_tokens > 0) {
        const costUSD = calculateUSDCost(glmModel, usage as any)
        addToTotalSessionCost(costUSD, usage as any, options.model)
      }

      yield {
        type: 'stream_event',
        event,
        ...(event.type === 'message_start' ? { ttftMs } : undefined),
      } as StreamEvent
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = isLikelyProviderAuthError(error)
    if (isAuthError) {
      clearProviderSessionConfig('glm')
      await clearProviderClientCache('glm')
    }
    logForDebugging(`[GLM] Error: ${errorMessage}`, { level: 'error' })
    yield createAssistantAPIErrorMessage({
      content: isAuthError
        ? `${getProviderAuthFailureMessage('glm')}\n\nAPI Error: ${errorMessage}`
        : `API Error: ${errorMessage}`,
      apiError: 'api_error',
      error: error instanceof Error ? error : new Error(String(error)),
    })
  }
}
