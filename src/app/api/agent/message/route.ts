import { createAgentRoute } from '@fluid/ui'
import type { AgentMessage } from '@earendil-works/pi-agent-core'
import { completeSimple, getEnvApiKey } from '@earendil-works/pi-ai'
import { getSystemPrompt } from '@/lang-app/system-prompt'
import { createLanguageTools } from '@/lang-app/tools/piDefinitions'
import { TUTOR_MODEL, UTILITY_MODEL } from '@/lang-app/models'
import type { LearningPlan } from '@/lang-app/memory/types'
import { createClient } from '@/lib/supabase/server'

const SUMMARY_SYSTEM_PROMPT = `You summarize the older part of a conversation between a language learner and their AI tutor, so the tutor can continue without it. The tutor separately receives the learner's roadmap, the current unit's phrases and rules, and their vocabulary record, so leave all of that out.

Keep, briefly:
- where the lesson stands: what was just practised and what the tutor intended to do next
- what the learner finds hard, described in English (for example "drops the dative suffix"), and what they handle easily
- preferences and personal details the learner stated: script or romanisation, pace, who they want to speak with
- anything the tutor promised to come back to

Do not list vocabulary or example sentences, and do not write words in the target language unless the learner's exact mistake cannot be described without them; when you must, copy them exactly as they appear. Do not continue the conversation or answer anything in it. Output only the summary.`

// The first compaction of a history that grew before compaction existed can
// exceed the summarizer's context; the oldest part is dropped to fit.
const MAX_SUMMARY_INPUT_CHARS = 200_000

async function summarizeHistory(
  conversationText: string,
  previousSummary: string | null,
): Promise<string> {
  const promptText =
    `<conversation>\n${conversationText.slice(-MAX_SUMMARY_INPUT_CHARS)}\n</conversation>\n\n` +
    (previousSummary ? `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n` : '') +
    'Summarize the conversation above following the system instructions. If a previous summary is present, merge it with the newer turns into a single updated summary.'
  const response = await completeSimple(
    UTILITY_MODEL,
    {
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'text', text: promptText }], timestamp: Date.now() }],
    },
    { maxTokens: 1024, apiKey: getEnvApiKey('anthropic') },
  )
  if (response.stopReason === 'error') {
    throw new Error(`Summarization failed: ${(response as { errorMessage?: string }).errorMessage ?? 'unknown error'}`)
  }
  return response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('\n')
}

// Reuse one auth lookup across loadHistory and saveHistory in the same request.
const userCache = new WeakMap<Request, Promise<{ id: string } | null>>()

function getUser(request: Request): Promise<{ id: string } | null> {
  let pending = userCache.get(request)
  if (!pending) {
    pending = createClient()
      .then(supabase => supabase.auth.getUser())
      .then(({ data }) => (data.user ? { id: data.user.id } : null))
    userCache.set(request, pending)
  }
  return pending
}

// Curriculum design runs inside a tool call; 300 is the Hobby plan ceiling.
export const maxDuration = 300

export const POST = createAgentRoute({
  provider: 'anthropic',
  model: TUTOR_MODEL,
  buildSystemPrompt: (params) =>
    getSystemPrompt(
      params.language as string,
      params.languageName as string,
      (params.memoryContext as string | null) ?? null,
    ),
  buildTools: (params, send) =>
    createLanguageTools(send, {
      language: params.language as string | undefined,
      memoryContext: params.memoryContext as string | null | undefined,
      plan: params.plan as LearningPlan | null | undefined,
    }),
  loadHistory: async (params, request) => {
    const user = await getUser(request)
    if (!user) return null
    const supabase = await createClient()
    const { data } = await supabase
      .from('conversation_history')
      .select('messages')
      .eq('user_id', user.id)
      .eq('language', params.language as string)
      .maybeSingle()
    return (data?.messages as AgentMessage[]) ?? []
  },
  saveHistory: async (messages, params, request) => {
    const user = await getUser(request)
    if (!user) return
    const supabase = await createClient()
    await supabase.from('conversation_history').upsert(
      {
        user_id: user.id,
        language: params.language as string,
        messages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,language' },
    )
  },
  compaction: { summarize: summarizeHistory, contextWindow: 30_000, reserveTokens: 0, keepRecentTokens: 10_000 },
})
