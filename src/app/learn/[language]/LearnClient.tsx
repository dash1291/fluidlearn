'use client'

import { useMemo } from 'react'
import { AgentView } from '@/framework/ui/AgentView'
import { languageComponentRegistry } from '@/lang-app/tools/registry'
import { LanguageMemoryStore } from '@/lang-app/memory/store'

interface Props {
  language: string
  languageName: string
}

export function LearnClient({ language, languageName }: Props) {
  // Stable memory store instance for this language session
  const memoryStore = useMemo(() => new LanguageMemoryStore(language), [language])

  const agentConfig = useMemo(
    () => ({
      endpoint: '/api/agent/message',
      toolEndpoint: '/api/agent/tool-result',
      persistKey: `fluid_conversation_${language}`,
      getRequestParams: () => ({
        language,
        languageName,
        memoryContext: memoryStore.getContext(),
      }),
      startTrigger: '__lesson_start__',
      onExerciseResult: (
        toolName: string,
        input: Record<string, unknown>,
        result: unknown,
      ) => {
        memoryStore.recordExerciseResult(toolName, input, result)
      },
      onTurnComplete: (newMessages: unknown[]) => {
        const existingPreferences = memoryStore.getPreferences()
        let body: string
        try {
          body = JSON.stringify({ newMessages, existingPreferences, languageName })
        } catch {
          return
        }
        fetch('/api/agent/extract-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
          .then(r => r.json())
          .then(({ preferences }) => {
            if (preferences) memoryStore.updatePreferences(preferences)
          })
          .catch(() => {})
      },
      onSessionEnd: () => {
        memoryStore.endSession()
      },
    }),
    [language, languageName, memoryStore],
  )

  return (
    <AgentView
      agentConfig={agentConfig}
      registry={languageComponentRegistry}
      placeholder={`Message your ${languageName} tutor...`}
    />
  )
}
