import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'

export type ProviderName = 'anthropic' | 'openai'

export interface ProviderConfig {
  provider: ProviderName
  model: string
}

export function getModel(config: ProviderConfig): LanguageModelV1 {
  switch (config.provider) {
    case 'anthropic':
      return anthropic(config.model)
    case 'openai':
      return openai(config.model)
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}
