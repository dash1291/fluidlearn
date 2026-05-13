# Pi Framework

A reusable, self-contained framework for building conversational AI applications with interactive tool-based widgets. The agent streams responses via SSE and can inject interactive React components into the chat flow.

## Philosophy

The LLM doesn't just chat — it can inject interactive widgets into the conversation, collect structured input from them, and continue the dialogue based on that input.

## Directory Structure

```
src/framework/
├── hooks/
│   └── useAgent.ts          — React hook managing SSE streaming, tool calls, persistence
├── memory/
│   ├── localStorage.ts      — Browser storage helpers
│   └── types.ts             — IMemoryStore interface for domain-specific state
├── server/
│   └── createAgentRoute.ts  — Factory for creating Next.js API agent routes
├── types.ts                 — Core types: DisplayItem, AgentConfig, ComponentRegistry
└── ui/
    ├── AgentView.tsx        — Chat shell with streaming bubbles, search, pagination
    ├── ComponentHost.tsx    — Renders registered React components for tool calls
    └── MessageBubble.tsx    — User / assistant message bubbles
```

## Core Concepts

### 1. AgentConfig (what the app provides)

```ts
interface AgentConfig {
  endpoint: string                      // POST route for SSE messages
  persistKey?: string                  // localStorage key for conversation
  startTrigger?: string                // Optional auto-sent message on mount
  getRequestParams: () => object       // Extra JSON sent with each message
  onExerciseResult?: (tool, input, result) => void
  onConversationSave?: (messages) => void
  onTurnComplete?: (newMessages) => void
  onSessionEnd?: () => void
}
```

### 2. Tool Definition (what the server provides)

Tools are JSONSchema-described functions. The LLM decides when to call them.

```ts
import { Type } from '@earendil-works/pi-ai'

{
  name: 'show_quiz',
  label: 'Quiz',
  description: 'Display an interactive quiz question',
  parameters: Type.Object({
    question: Type.String(),
    options: Type.Array(Type.String()),
    correct_index: Type.Number(),
  }),
  execute: async (toolCallId, params, send) => {
    // Emit to client so AgentView renders the matching component
    send({ type: 'tool_call', toolCallId, toolName: 'show_quiz', args: params })
    // Signal the agent to pause until user submits
    return { content: [], details: { __awaiting: toolCallId }, terminate: true }
  }
}
```

### 3. Component Registry (what the app provides)

Maps tool names to React components that handle user interaction.

```ts
import type { ComponentRegistry } from '@/framework/types'

export const myRegistry: ComponentRegistry = {
  show_quiz: QuizComponent,
  show_chart: ChartComponent,
}
```

### 4. IMemoryStore (what the app provides)

Pluggable state tracker. Injected into the system prompt as context.

```ts
interface IMemoryStore {
  getContext(): string | null           // Returns context injected into system prompt
  recordExerciseResult(tool, input, result): void
  endSession(): void
}
```

## Server Route Factory

Instead of writing a custom API route, use the factory:

```ts
// app/api/agent/message/route.ts
import { createAgentRoute } from '@/framework/server/createAgentRoute'

export const POST = createAgentRoute({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  buildSystemPrompt: (params) => `You are a ${params.domain} tutor...`,
  buildTools: (params, send) => [
    // ... your tool definitions
  ],
})
```

## Client Setup

```tsx
// app/page.tsx
import { AgentView } from '@/framework/ui/AgentView'
import { useAgent } from '@/framework/hooks/useAgent'

function MyApp() {
  const agentConfig = {
    endpoint: '/api/agent/message',
    persistKey: 'myapp_conversation',
    getRequestParams: () => ({ domain: 'math' }),
    onSessionEnd: () => console.log('session ended'),
  }

  return (
    <AgentView
      agentConfig={agentConfig}
      registry={myComponentRegistry}
      placeholder="Ask your tutor..."
    />
  )
}
```

## Features Provided Out of the Box

- **Streaming text** with typing cursor animation
- **Reverse pagination** — loads only recent messages, infinite scroll up for older
- **Server-side message search** across all conversations
- **Tool call lifecycle** — render widget → collect input → feed result back to LLM
- **Auto-save** to localStorage and hooks for remote persistence
- **Queued messages** — user can type while LLM is still streaming; message auto-sends after turn completes

## What Apps Must Provide

| Concern | Provided by app |
|---|---|
| System prompt | `buildSystemPrompt` function |
| Tool definitions | `buildTools` function |
| Interactive widgets | React components in a `ComponentRegistry` |
| Domain memory | `IMemoryStore` implementation |
| Auth / layout | App's own login, headers, menus |
| Database tables | App's own Supabase / DB schema |

## Example Apps Built on This Framework

- **Fluid** (language learning) — `show_lesson`, `show_flashcard`, `show_fill_blank`, etc.
- **Math tutor** — `show_problem`, `show_hint`, `draw_graph`
- **Coding coach** — `show_coding_problem`, `run_tests`, `complexity_analysis`
- **Fitness tracker** — `show_workout`, `log_set`, `show_progress_chart`

## Dependencies

Peer dependencies your app must install:

- `react` ^19
- `react-dom` ^19
- `next` ^16
- `react-markdown` ^10
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-ai`
