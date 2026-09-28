import { getModel } from '@earendil-works/pi-ai'
import type { Model } from '@earendil-works/pi-ai'

type AnthropicModel = Model<'anthropic-messages'>

// `reasoning: false` keeps pi-ai from sending any `thinking` parameter. These
// models think adaptively when it is omitted, and Fable rejects an explicit
// `thinking: { type: 'disabled' }`.
function claude5(id: string, name: string, cost: AnthropicModel['cost']): AnthropicModel {
  return {
    id,
    name,
    api: 'anthropic-messages',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    reasoning: false,
    input: ['text', 'image'],
    cost,
    contextWindow: 1_000_000,
    maxTokens: 128_000,
  }
}

export const TUTOR_MODEL: AnthropicModel = claude5('claude-sonnet-5', 'Claude Sonnet 5', {
  input: 2,
  output: 10,
  cacheRead: 0.2,
  cacheWrite: 2.5,
})

export const DESIGNER_MODEL: AnthropicModel = claude5('claude-fable-5-1', 'Claude Fable 5.1', {
  input: 10,
  output: 50,
  cacheRead: 1,
  cacheWrite: 12.5,
})

export const UTILITY_MODEL = getModel('anthropic', 'claude-haiku-4-5')
