import { createAgentRoute } from '@fluid/ui'
import type { AgentMessage } from '@earendil-works/pi-agent-core'
import { getSystemPrompt } from '@/lang-app/system-prompt'
import { createLanguageTools } from '@/lang-app/tools/piDefinitions'
import { createClient } from '@/lib/supabase/server'

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
})
