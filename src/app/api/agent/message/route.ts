import { Agent } from '@earendil-works/pi-agent-core'
import { getModel, getEnvApiKey } from '@earendil-works/pi-ai'
import { streamSimpleAnthropic } from '@earendil-works/pi-ai/anthropic'
import { getSystemPrompt } from '@/lang-app/system-prompt'
import { createLanguageTools } from '@/lang-app/tools/piDefinitions'
import type { AgentMessage } from '@earendil-works/pi-agent-core'

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
  const { newMessage, language, languageName, memoryContext } = params
  // Ensure tool result messages always have content array (old client data may be missing it)
  const messages = (params.messages ?? []).map(m => {
    if ((m as any).role === 'toolResult' && !(m as any).content) {
      return { ...m, content: [] }
    }
    return m
  })

  const model = getModel('anthropic', 'claude-sonnet-4-6')
  console.log('[agent] model:', model?.id ?? model, 'apiKey prefix:', getEnvApiKey('anthropic')?.slice(0, 16))
  const tools = createLanguageTools(send)

  const agent = new Agent({
    initialState: {
      model,
      systemPrompt: getSystemPrompt(language, languageName, memoryContext ?? null),
      tools,
      messages: messages ?? [],
    },
    getApiKey: () => getEnvApiKey('anthropic'),
    streamFn: streamSimpleAnthropic,
  })

  agent.subscribe(event => {
    if (event.type === 'message_update') {
      const { assistantMessageEvent } = event
      if (assistantMessageEvent.type === 'text_delta') {
        send({ type: 'text_delta', delta: assistantMessageEvent.delta })
      }
    }
    if (event.type === 'tool_execution_end') {
      console.log('[agent] tool_execution_end', event.toolName, event.toolCallId, JSON.stringify(event.result).slice(0, 200))
    }
    if (event.type === 'turn_end') {
      const msg = (event as any).message
      if (msg?.errorMessage) {
        console.error('[agent] turn_end error:', msg.stopReason, msg.errorMessage)
      }
    }
    if (event.type === 'agent_end') {
      const msgs = event.messages
      console.log('[agent] agent_end messages:', msgs.map((m: any) => ({
        role: m.role,
        toolCallId: m.toolCallId,
        details: m.details,
        contentTypes: m.content?.map((c: any) => c.type),
        stopReason: m.stopReason,
        errorMessage: m.errorMessage,
      })))
      const awaitingIdx = msgs.findIndex(
        m => (m as unknown as Record<string, unknown>).role === 'toolResult'
          && ((m as unknown as Record<string, unknown>).details as Record<string, unknown>)?.__awaiting,
      )
      console.log('[agent] awaitingIdx:', awaitingIdx, '→ sending:', awaitingIdx !== -1 ? 'paused' : 'done')
      if (awaitingIdx !== -1) {
        send({ type: 'paused', messages: msgs.slice(0, awaitingIdx) })
      } else {
        send({ type: 'done', messages: msgs })
      }
    }
  })

  try {
    if (newMessage) {
      await agent.prompt(newMessage)
    } else {
      await agent.continue()
    }
  } catch (err) {
    console.error('[agent] prompt/continue threw:', err)
    throw err
  }
}
