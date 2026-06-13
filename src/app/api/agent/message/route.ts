import { createAgentRoute } from '@fluid/ui'
import { getSystemPrompt } from '@/lang-app/system-prompt'
import { createLanguageTools } from '@/lang-app/tools/piDefinitions'

export const POST = createAgentRoute({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  buildSystemPrompt: (params) =>
    getSystemPrompt(
      params.language as string,
      params.languageName as string,
      (params.memoryContext as string | null) ?? null,
    ),
  buildTools: (params, send) => createLanguageTools(send, params.language as string | undefined),
})
