export type ModelProvider = 'anthropic' | 'openai' | 'qwen' | 'minimax' | 'gemini'

export interface ModelOption {
  id: string
  label: string
  provider: ModelProvider
}

export type ModelTier = 'standard' | 'premium'

export interface ModelGroup {
  tier: ModelTier
  label: string
  models: ModelOption[]
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    tier: 'standard',
    label: 'Standar',
    models: [
      { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6',  provider: 'anthropic' },
      { id: 'gemini-3.5-flash',   label: 'Gemini 3.5 Flash',   provider: 'gemini' },
      { id: 'qwen3.6-max',        label: 'Qwen 3.6 Max',       provider: 'qwen' },
      { id: 'qwen3.6-plus',       label: 'Qwen 3.6 Plus',      provider: 'qwen' },
      { id: 'MiniMax-M2.5',       label: 'MiniMax M2.5',       provider: 'minimax' },
    ],
  },
  {
    tier: 'premium',
    label: 'Premium',
    models: [
      { id: 'gpt-5.4-thinking',        label: 'GPT-5.4 Thinking',        provider: 'openai' },
      { id: 'claude-opus-4-6',          label: 'Claude Opus 4.6',          provider: 'anthropic' },
      { id: 'gemini-3.1-pro-preview',   label: 'Gemini 3.1 Pro Preview',   provider: 'gemini' },
    ],
  },
]

export const ALL_MODELS: ModelOption[] = MODEL_GROUPS.flatMap((g) => g.models)

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

export function findModel(id: string): ModelOption | undefined {
  return ALL_MODELS.find((m) => m.id === id)
}
