'use client'

import { useMemo, useEffect, useCallback } from 'react'
import { AgentView } from '@fluid/ui'
import { languageComponentRegistry } from '@/lang-app/tools/registry'
import { LanguageMemoryStore } from '@/lang-app/memory/store'
import { createClient } from '@/lib/supabase/client'
import { lsSet } from '@fluid/ui'
import { StudyTimer } from './StudyTimer'
import type { LanguageMemoryData, DesignedPlan, UnitDetail } from '@/lang-app/memory/types'

interface Props {
  language: string
  languageName: string
  initialMessages: unknown[]
  initialMemory: LanguageMemoryData | null
  initialTotalSeconds?: number
  authenticated?: boolean
}

export function LearnClient({ language, languageName, initialMessages, initialMemory, initialTotalSeconds = 0, authenticated = false }: Props) {
  const persistKey = `fluid_conversation_${language}`

  const memoryStore = useMemo(
    () => new LanguageMemoryStore(language, initialMemory ?? undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  )

  const flushTime = useCallback(
    (useBeacon = false) => {
      const seconds = memoryStore.pauseStudyTimer()
      if (seconds <= 0) return
      const body = JSON.stringify({ language, seconds })
      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/agent/track-time', body)
      } else {
        fetch('/api/agent/track-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }).catch(() => {})
      }
    },
    [language, memoryStore],
  )

  // Anonymous sessions keep history client-side; seed localStorage from any
  // Supabase data on load. Authenticated sessions read history server-side and
  // hydrate the display from initialMessages, so localStorage is unused.
  useEffect(() => {
    if (!authenticated && initialMessages.length > 0) {
      lsSet(persistKey, { piMessages: initialMessages })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track active study time for this language session
  useEffect(() => {
    memoryStore.startStudyTimer()

    const handleVisibility = () => {
      if (document.hidden) {
        flushTime(false)
      } else {
        memoryStore.startStudyTimer()
      }
    }

    const handleBeforeUnload = () => {
      flushTime(true)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      flushTime(false)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, memoryStore])

  const agentConfig = useMemo(
    () => {
      // Upsert the full memory blob to Supabase now (not just at session end),
      // so a freshly created/updated plan survives an abrupt tab close.
      const persistMemory = () => {
        const data = memoryStore.getData()
        if (!data) return
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return
          supabase.from('language_memory').upsert(
            { user_id: user.id, language, data, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,language' },
          )
        })
      }

      return {
      endpoint: '/api/agent/message',
      persistKey,
      serverHistory: authenticated,
      initialMessages,
      getRequestParams: () => ({
        language,
        languageName,
        memoryContext: memoryStore.getContext(),
        plan: memoryStore.getPlan(),
      }),
      startTrigger: '__lesson_start__',
      onExerciseResult: (
        toolName: string,
        input: Record<string, unknown>,
        result: unknown,
      ) => {

        if (toolName === 'set_learning_plan') {
          // The tool call event carries the designed plan; a replay from history
          // carries only the tutor's request and must not overwrite the stored plan.
          if (Array.isArray(input.milestones) && input.milestones.length > 0) {
            memoryStore.setPlan(input as unknown as DesignedPlan)
            persistMemory()
          }
          return
        }

        if (toolName === 'update_learning_plan') {
          const plan = memoryStore.getPlan()
          const unitId = input.completedUnitId as string | undefined
          const milestoneId = input.completedMilestoneId as string | undefined
          const nextUnitId = input.nextUnitId as string | undefined
          const nextUnitDetail = input.nextUnitDetail as UnitDetail | undefined

          if (unitId) {
            memoryStore.completeUnit(unitId)
          } else if (milestoneId) {
            memoryStore.completeMilestone(milestoneId)
          } else if (plan?.currentUnitId) {
            memoryStore.completeUnit(plan.currentUnitId)
          } else if (plan?.currentMilestoneId) {
            memoryStore.completeMilestone(plan.currentMilestoneId)
          } else {
            return
          }
          if (nextUnitId && nextUnitDetail) memoryStore.setUnitDetail(nextUnitId, nextUnitDetail)
          persistMemory()
          return
        }

        memoryStore.recordExerciseResult(
          toolName,
          input,
          result,
        )
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
        flushTime(false)
        memoryStore.endSession()
        // Persist final memory state to Supabase
        persistMemory()
      },
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, languageName, memoryStore, authenticated],
  )

  return (
    <AgentView
      agentConfig={agentConfig}
      registry={languageComponentRegistry}
      placeholder={`Message your ${languageName} tutor...`}
      toolbarRight={<StudyTimer initialTotalSeconds={initialTotalSeconds} />}
    />
  )
}
