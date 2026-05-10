import { Agent } from '@earendil-works/pi-agent-core'
import {
  getModel,
  getEnvApiKey,
  registerBuiltInApiProviders,
} from '@earendil-works/pi-ai'
import { getSystemPrompt } from '@/lang-app/system-prompt'
import { createLanguageTools } from '@/lang-app/tools/piDefinitions'
import type { AgentMessage } from '@earendil-works/pi-agent-core'

registerBuiltInApiProviders()

const encoder = new TextEncoder()

function sseChunk(event: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
}

export async function POST(request: Request) {
  const {
    messages,
    newMessage,
    language,
    languageName,
    memoryContext,
  }: {
    messages: AgentMessage[]
    newMessage?: string
    language: string
    languageName: string
    memoryContext: string | null
  } = await request.json()

  let ctrl!: ReadableStreamDefaultController<Uint8Array>

  const send = (event: object) => {
    try {
      ctrl.enqueue(sseChunk(event))
    } catch {
      // stream already closed
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
      runAgent({ messages, newMessage, language, languageName, memoryContext }, send)
        .catch(err => {
          send({ type: 'error', message: err instanceof Error ? err.message : String(err) })
        })
        .finally(() => c.close())
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function runAgent(
  params: {
    messages: AgentMessage[]
    newMessage?: string
    language: string
    languageName: string
    memoryContext: string | null
  },
  send: (event: object) => void,
) {
  const { messages, newMessage, language, languageName, memoryContext } = params

  const model = getModel('anthropic', 'claude-sonnet-4-6')
  const tools = createLanguageTools(send)

  const agent = new Agent({
    initialState: {
      model,
      systemPrompt: getSystemPrompt(language, languageName, memoryContext ?? null),
      tools,
      messages: messages ?? [],
    },
    getApiKey: () => getEnvApiKey('anthropic'),
  })

  agent.subscribe(event => {
    if (event.type === 'message_update') {
      const { assistantMessageEvent } = event
      if (assistantMessageEvent.type === 'text_delta') {
        send({ type: 'text_delta', delta: assistantMessageEvent.delta })
      }
    }
    if (event.type === 'agent_end') {
      const msgs = event.messages
      // Find the first __awaiting placeholder. When a displayed tool (show_lesson) and an
      // interactive tool (show_flashcard) are called in the same assistant message, Pi won't
      // terminate early (not all tools set terminate:true), so the agent runs another LLM turn.
      // The placeholder ends up somewhere in the middle, not the last message.
      // Strip the placeholder and everything after it so the client gets a clean paused state.
      const awaitingIdx = msgs.findIndex(
        m => (m as unknown as Record<string, unknown>).role === 'toolResult'
          && ((m as unknown as Record<string, unknown>).details as Record<string, unknown>)?.__awaiting,
      )
      if (awaitingIdx !== -1) {
        send({ type: 'paused', messages: msgs.slice(0, awaitingIdx) })
      } else {
        send({ type: 'done', messages: msgs })
      }
    }
  })

  if (newMessage) {
    await agent.prompt(newMessage)
  } else {
    await agent.continue()
  }
}
