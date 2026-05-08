import type { ProviderConfig } from '@/framework/provider'

export interface Language {
  code: string
  name: string
  flag: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'spanish', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'french', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'japanese', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'german', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'portuguese', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
  { code: 'italian', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'mandarin', name: 'Mandarin', flag: '🇨🇳', nativeName: '普通话' },
  { code: 'kannada', name: 'Kannada', flag: '🇮🇳', nativeName: 'ಕನ್ನಡ' },
]

export function getLanguage(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)
}

export const LLM_CONFIG: ProviderConfig = {
  provider: (process.env.LLM_PROVIDER ?? 'anthropic') as ProviderConfig['provider'],
  model: process.env.LLM_MODEL ?? 'claude-sonnet-4-6',
}
