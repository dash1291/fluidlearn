export interface Language {
  code: string
  name: string
  flag: string
  nativeName: string
  speechCode: string
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'spanish', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español', speechCode: 'es' },
  { code: 'french', name: 'French', flag: '🇫🇷', nativeName: 'Français', speechCode: 'fr' },
  { code: 'japanese', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語', speechCode: 'ja' },
  { code: 'german', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch', speechCode: 'de' },
  { code: 'portuguese', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português', speechCode: 'pt' },
  { code: 'italian', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano', speechCode: 'it' },
  { code: 'mandarin', name: 'Mandarin', flag: '🇨🇳', nativeName: '普通话', speechCode: 'zh-CN' },
  { code: 'kannada', name: 'Kannada', flag: '🇮🇳', nativeName: 'ಕನ್ನಡ', speechCode: 'kn' },
  { code: 'hindi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी', speechCode: 'hi' },
  { code: 'tamil', name: 'Tamil', flag: '🇮🇳', nativeName: 'தமிழ்', speechCode: 'ta' },
  ]

export function getLanguage(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)
}

export type ProviderName = 'anthropic' | 'openai'

export const LLM_CONFIG = {
  provider: (process.env.LLM_PROVIDER ?? 'anthropic') as ProviderName,
  model: process.env.LLM_MODEL ?? 'claude-sonnet-4-6',
}
