'use client'

import { useMemo } from 'react'
import { AgentView } from '@/framework/ui/AgentView'
import { languageComponentRegistry } from '@/lang-app/tools/registry'
import { LanguageMemoryStore } from '@/lang-app/memory/store'
import { createClient } from '@/lib/supabase/client'
import { lsGet, lsSet } from '@/framework/memory/localStorage'
import type { LanguageMemoryData } from '@/lang-app/memory/types'

interface PersistedConversation {
  piMessages: unknown[]
}

interface Props {
  language: string
  languageName: string
  initialMessages: unknown[]
  initialMemory: LanguageMemoryData | null
}

export function LearnClient({ language, languageName, initialMessages, initialMemory }: Props) {
  const persistKey = `fluid_conversation_${language}`

  const memoryStore = useMemo(
    () => new LanguageMemoryStore(language, initialMemory ?? undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  )

  // Remote state always wins — overwrite localStorage with Supabase data on load.
  // If Supabase has no history yet, keep whatever is in localStorage (e.g. pre-login local session).
  useMemo(() => {
    if (initialMessages.length > 0) {
      lsSet(persistKey, { piMessages: initialMessages })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const agentConfig = useMemo(
    () => ({
      endpoint: '/api/agent/message',
      persistKey,
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
      onConversationSave: (fullMessages: unknown[]) => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return
          supabase.from('conversation_history').upsert({
            user_id: user.id,
            language,
            messages: fullMessages,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,language' }).then(({ error }) => {
            if (error) console.error('Failed to save conversation:', error.message)
          })
        })
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
        // Persist final memory state to Supabase
        const data = memoryStore.getData()
        if (!data) return
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return
          supabase.from('language_memory').upsert({
            user_id: user.id,
            language,
            data,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,language' })
        })
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
