import { applyConfigEnvironmentVariables } from '../utils/managedEnv.js'
import {
  clearProviderClientCache,
  getProviderDefaultBaseUrl,
  getProviderDefaultModelSeed,
  getProviderExistingApiKey,
  getProviderSuggestedModels,
  isInteractiveAPIProvider,
  setProviderSessionConfig,
} from '../utils/providerSessionConfig.js'
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { updateSettingsForSource } from '@anthropic/config'
import { getAPIProvider } from '../utils/model/providers.js'
import { useKeybinding } from '../keybindings/useKeybinding.js'
import { Box, Text } from '../ink.js'
import { Select } from '../components/CustomSelect/select.js'
import { Pane } from '../components/design-system/Pane.js'
import TextInput from '../components/TextInput.js'
import type { LocalJSXCommandOnDone } from '../types/command.js'
import type { LocalJSXCommandCall } from '../types/command.js'

const VALID_PROVIDERS = [
  'anthropic',
  'openai',
  'glm',
  'deepseek',
  'qwen',
  'gemini',
  'grok',
  'bedrock',
  'vertex',
  'foundry',
] as const

type ProviderArg = (typeof VALID_PROVIDERS)[number]
type ApiProviderArg = Extract<
  ProviderArg,
  'openai' | 'glm' | 'deepseek' | 'qwen' | 'gemini' | 'grok'
>

function getEnvVarForProvider(provider: Exclude<ProviderArg, 'anthropic' | 'openai' | 'glm' | 'deepseek' | 'qwen' | 'gemini' | 'grok'>): string {
  switch (provider) {
    case 'bedrock':
      return 'CLAUDE_CODE_USE_BEDROCK'
    case 'vertex':
      return 'CLAUDE_CODE_USE_VERTEX'
    case 'foundry':
      return 'CLAUDE_CODE_USE_FOUNDRY'
  }
}

function clearProviderSelectionEnv(): void {
  delete process.env.CLAUDE_CODE_USE_BEDROCK
  delete process.env.CLAUDE_CODE_USE_VERTEX
  delete process.env.CLAUDE_CODE_USE_FOUNDRY
  delete process.env.CLAUDE_CODE_USE_OPENAI
  delete process.env.CLAUDE_CODE_USE_GLM
  delete process.env.CLAUDE_CODE_USE_DEEPSEEK
  delete process.env.CLAUDE_CODE_USE_QWEN
  delete process.env.CLAUDE_CODE_USE_GEMINI
  delete process.env.CLAUDE_CODE_USE_GROK
}

async function persistProviderSelection(provider: ProviderArg | 'unset'): Promise<void> {
  if (provider === 'unset') {
    updateSettingsForSource('userSettings', { modelType: undefined })
    clearProviderSelectionEnv()
    return
  }

  if (
    provider === 'anthropic' ||
    provider === 'openai' ||
    provider === 'glm' ||
    provider === 'deepseek' ||
    provider === 'qwen' ||
    provider === 'gemini' ||
    provider === 'grok'
  ) {
    clearProviderSelectionEnv()
    updateSettingsForSource('userSettings', { modelType: provider as any })
    applyConfigEnvironmentVariables()
    await clearProviderClientCache(provider)
    return
  }

  clearProviderSelectionEnv()
  process.env[getEnvVarForProvider(provider)] = '1'
  applyConfigEnvironmentVariables()
}

function ProviderInteractiveSetup({
  provider,
  onDone,
}: {
  provider: ApiProviderArg
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const [step, setStep] = useState<
    'key' | 'baseUrl' | 'modelSelect' | 'modelCustom'
  >('key')
  const [apiKey, setApiKey] = useState(() => getProviderExistingApiKey(provider))
  const [apiKeyCursor, setApiKeyCursor] = useState(apiKey.length)
  const [baseUrl, setBaseUrl] = useState(() => getProviderDefaultBaseUrl(provider))
  const [baseUrlCursor, setBaseUrlCursor] = useState(baseUrl.length)
  const [model, setModel] = useState(() => getProviderDefaultModelSeed(provider))
  const [modelCursor, setModelCursor] = useState(model.length)

  const suggestedModels = getProviderSuggestedModels(provider)

  useEffect(() => {
    if (!model && suggestedModels[0]) {
      setModel(suggestedModels[0])
      setModelCursor((suggestedModels[0] ?? '').length)
    }
  }, [model, suggestedModels])

  useKeybinding(
    'confirm:no',
    () => {
      if (step === 'modelCustom') {
        setStep('modelSelect')
        return
      }
      if (step === 'modelSelect') {
        setStep('baseUrl')
        return
      }
      if (step === 'baseUrl') {
        setStep('key')
        return
      }
      onDone('Provider switch cancelled.', { display: 'system' })
    },
    { context: 'Confirmation' },
  )

  const save = useCallback(async (modelOverride?: string) => {
    const finalModel = (modelOverride ?? model).trim()
    if (!apiKey.trim()) {
      onDone(`Missing API key for ${provider}.`, { display: 'system' })
      return
    }
    if (!finalModel) {
      onDone(`Missing default model for ${provider}.`, { display: 'system' })
      return
    }

    setProviderSessionConfig(provider, {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      defaultModel: finalModel,
    })
    await persistProviderSelection(provider)
    onDone(
      `API provider set to ${provider} · base URL ${baseUrl.trim() || '(default)'} · default model ${finalModel}`,
    )
  }, [apiKey, baseUrl, model, onDone, provider])

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold>{`Configure ${provider}`}</Text>
        <Text dimColor>
          Session-only credentials. They will be cleared when Vipercode exits.
        </Text>
        {step === 'key' ? (
          <Box flexDirection="column" gap={1}>
            <Text>{`Enter ${provider} API key`}</Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={() => setStep('baseUrl')}
              cursorOffset={apiKeyCursor}
              onChangeCursorOffset={setApiKeyCursor}
              mask="*"
              focus={true}
            />
            <Text dimColor>Press Enter to continue, Esc to cancel.</Text>
          </Box>
        ) : step === 'baseUrl' ? (
          <Box flexDirection="column" gap={1}>
            <Text>{`Enter ${provider} base URL`}</Text>
            <TextInput
              value={baseUrl}
              onChange={setBaseUrl}
              onSubmit={() => setStep('modelSelect')}
              cursorOffset={baseUrlCursor}
              onChangeCursorOffset={setBaseUrlCursor}
              focus={true}
            />
            <Text dimColor>Press Enter to continue, Esc to go back.</Text>
          </Box>
        ) : step === 'modelSelect' ? (
          <Box flexDirection="column" gap={1}>
            <Text>{`Choose default ${provider} model`}</Text>
            <Text dimColor>{`Recommended latest models for ${provider}`}</Text>
            <Select
              options={[
                ...suggestedModels.map(candidate => ({
                  label: candidate,
                  value: candidate,
                })),
                {
                  label: 'Custom model…',
                  value: '__custom__',
                },
              ]}
              initialValue={
                suggestedModels.includes(model) ? model : '__custom__'
              }
              onChange={value => {
                if (value === '__custom__') {
                  setStep('modelCustom')
                  return
                }
                setModel(value)
                void save(value)
              }}
            />
            <Text dimColor>Enter to select, Esc to go back.</Text>
          </Box>
        ) : (
          <Box flexDirection="column" gap={1}>
            <Text>{`Enter custom ${provider} model`}</Text>
            <Text dimColor>{`Suggested: ${suggestedModels.join(', ')}`}</Text>
            <TextInput
              value={model}
              onChange={setModel}
              onSubmit={() => void save()}
              cursorOffset={modelCursor}
              onChangeCursorOffset={setModelCursor}
              focus={true}
            />
            <Text dimColor>Press Enter to save, Esc to go back.</Text>
          </Box>
        )}
      </Box>
    </Pane>
  )
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const arg = args.trim().toLowerCase()

  if (!arg) {
    onDone(`Current API provider: ${getAPIProvider()}`, {
      display: 'system',
    })
    return null
  }

  if (arg === 'unset') {
    await persistProviderSelection('unset')
    onDone('API provider cleared (will use environment variables).', {
      display: 'system',
    })
    return null
  }

  if (!VALID_PROVIDERS.includes(arg as ProviderArg)) {
    onDone(
      `Invalid provider: ${arg}\nValid: ${VALID_PROVIDERS.join(', ')}`,
      { display: 'system' },
    )
    return null
  }

  if (isInteractiveAPIProvider(arg)) {
    return (
      <ProviderInteractiveSetup
        provider={arg}
        onDone={message =>
          onDone(message, {
            display: 'system',
          })
        }
      />
    )
  }

  await persistProviderSelection(arg as ProviderArg)
  onDone(`API provider set to ${arg}.`, { display: 'system' })
  return null
}
