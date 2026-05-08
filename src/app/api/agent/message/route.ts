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
      send({ type: 'done', messages: event.messages })
    }
  })

  if (newMessage) {
    await agent.prompt(newMessage)
  } else {
    await agent.continue()
  }
}
