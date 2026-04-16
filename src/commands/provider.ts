import type { Command } from '../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../utils/immediateCommand.js'
import { getAPIProvider } from '../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'provider',
  get description() {
    return `Switch API provider (currently ${getAPIProvider()})`
  },
  aliases: ['api'],
  argumentHint:
    '[anthropic|openai|glm|deepseek|qwen|gemini|grok|bedrock|vertex|foundry|unset]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./providerCommand.js'),
} satisfies Command
