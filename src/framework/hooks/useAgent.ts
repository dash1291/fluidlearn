'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { lsGet, lsSet } from '../memory/localStorage'
import type { AgentConfig, DisplayItem } from '../types'

// Mirrors Pi message types (client-safe — not imported from the Pi server package)
interface PiTextContent { type: 'text'; text: string }
interface PiToolCall { type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown> }
interface PiUserMessage { role: 'user'; content: string | PiTextContent[] }
interface PiAssistantMessage { role: 'assistant'; content: (PiTextContent | { type: 'thinking' } | PiToolCall)[] }
interface PiToolResultMessage { role: 'toolResult'; toolCallId: string; toolName: string; details?: unknown }
type PiMessage = PiUserMessage | PiAssistantMessage | PiToolResultMessage

interface PersistedState {
  piMessages: PiMessage[]
}

// Used only for restoring from localStorage — not called during active streaming
function buildDisplayItems(messages: PiMessage[], startTrigger?: string): DisplayItem[] {
  const toolResults = new Map<string, unknown>()
  for (const msg of messages) {
    if (msg.role === 'toolResult') {
      toolResults.set(msg.toolCallId, msg.details)
    }
  }

  const items: DisplayItem[] = []
  let msgIdx = 0

  for (const msg of messages) {
    if (msg.role === 'user') {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : (msg.content as PiTextContent[])
              .filter(b => b.type === 'text')
              .map(b => b.text)
              .join('')
      if (text && text !== startTrigger) {
        items.push({ kind: 'user_message', id: `msg-${msgIdx}-user`, text })
      }
    } else if (msg.role === 'assistant') {
      let textIdx = 0
      for (const block of msg.content) {
        if (block.type === 'text') {
          const text = (block as PiTextContent).text
          if (text) {
            items.push({
              kind: 'assistant_text',
              id: `msg-${msgIdx}-text-${textIdx++}`,
              text,
              isStreaming: false,
            })
          }
        } else if (block.type === 'toolCall') {
          const tc = block as PiToolCall
          const submitted = toolResults.has(tc.id)
          items.push({
            kind: 'exercise',
            id: `msg-${msgIdx}-tool-${tc.id}`,
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.arguments,
            submitted,
            result: submitted ? toolResults.get(tc.id) : undefined,
          })
        }
      }
    }
    msgIdx++
  }

  return items
}

export function useAgent(config: AgentConfig) {
  const configRef = useRef(config)
  configRef.current = config

  const piMessagesRef = useRef<PiMessage[]>([])

  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([])
  const displayItemsRef = useRef<DisplayItem[]>([])
  displayItemsRef.current = displayItems

  const [isStreaming, setIsStreaming] = useState(false)
  const isStreamingRef = useRef(false)

  const streamingTextIdRef = useRef<string | null>(null)
  // Message queued to send after current agent turn completes (already shown in UI)
  const pendingUserMessageRef = useRef<string | null>(null)

  const skipExercise = useCallback((toolCallId: string) => {
    setDisplayItems(prev =>
      prev.map(item =>
        item.kind === 'exercise' && item.toolCallId === toolCallId
          ? { ...item, submitted: true, result: { skipped: true } }
          : item,
      ),
    )
    fetch(configRef.current.toolEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolCallId, result: { skipped: true } }),
    }).catch(err => console.error('Skip exercise failed:', err))
  }, [])

  const sendMessage = useCallback(async (text: string, visible: boolean) => {
    if (isStreamingRef.current) return
    isStreamingRef.current = true
    setIsStreaming(true)
    streamingTextIdRef.current = null
    let followUp: string | null = null

    if (visible) {
      setDisplayItems(prev => [
        ...prev,
        { kind: 'user_message', id: `user-${Date.now()}`, text },
      ])
    }

    const { endpoint, getRequestParams } = configRef.current
    const params = getRequestParams()

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: piMessagesRef.current,
          newMessage: text,
          ...params,
        }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event: Record<string, unknown>
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (event.type === 'text_delta') {
            const delta = event.delta as string
            const existingId = streamingTextIdRef.current
            if (existingId) {
              setDisplayItems(prev =>
                prev.map(item =>
                  item.kind === 'assistant_text' && item.id === existingId
                    ? { ...item, text: item.text + delta }
                    : item,
                ),
              )
            } else {
              const newId = `stream-text-${Date.now()}`
              streamingTextIdRef.current = newId
              setDisplayItems(prev => [
                ...prev,
                { kind: 'assistant_text', id: newId, text: delta, isStreaming: true },
              ])
            }
          }

          if (event.type === 'tool_call') {
            streamingTextIdRef.current = null
            setDisplayItems(prev => [
              ...prev,
              {
                kind: 'exercise',
                id: `stream-tool-${event.toolCallId}`,
                toolCallId: event.toolCallId as string,
                toolName: event.toolName as string,
                input: event.args as Record<string, unknown>,
                submitted: false,
              },
            ])
          }

          if (event.type === 'done') {
            // agent_end.messages is new messages only — prepend existing history
            const newMessages = event.messages as PiMessage[]
            const fullMessages = [...piMessagesRef.current, ...newMessages]
            piMessagesRef.current = fullMessages
            // Finalize streaming text in-place (don't rebuild — display was built incrementally)
            setDisplayItems(prev =>
              prev.map(i =>
                i.kind === 'assistant_text' && i.isStreaming ? { ...i, isStreaming: false } : i,
              ),
            )
            const key = configRef.current.persistKey
            if (key) lsSet(key, { piMessages: fullMessages } satisfies PersistedState)
            try {
              configRef.current.onConversationSave?.(fullMessages)
            } catch (err) {
              console.error('onConversationSave error:', err)
            }
            // Capture follow-up before any callback that might throw
            followUp = pendingUserMessageRef.current
            pendingUserMessageRef.current = null
            try {
              configRef.current.onTurnComplete?.(newMessages)
            } catch (err) {
              console.error('onTurnComplete error:', err)
            }
          }

          if (event.type === 'error') {
            console.error('Agent error:', event.message)
          }
        }
      }
    } catch (err) {
      console.error('Stream read error:', err)
    } finally {
      isStreamingRef.current = false
      setIsStreaming(false)
      // Follow-up message was already shown in the UI (added by sendUserMessage), so visible=false
      if (followUp) sendMessage(followUp, false)
    }
  }, [])

  useEffect(() => {
    let restored: PiMessage[] = []
    const key = configRef.current.persistKey
    if (key) {
      const saved = lsGet<PersistedState>(key)
      restored = saved?.piMessages ?? []
    }

    if (restored.length > 0) {
      piMessagesRef.current = restored
      const items = buildDisplayItems(restored, configRef.current.startTrigger)
      setDisplayItems(items)
      displayItemsRef.current = items
    } else if (configRef.current.startTrigger) {
      sendMessage(configRef.current.startTrigger, false)
    }

    return () => {
      configRef.current.onSessionEnd?.()
    }
  // sendMessage is stable (useCallback with no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendUserMessage = useCallback(
    (text: string) => {
      if (!isStreamingRef.current) {
        sendMessage(text, true)
        return
      }
      // Agent is mid-run — show message immediately and queue it for after the current turn
      setDisplayItems(prev => [
        ...prev,
        { kind: 'user_message', id: `user-${Date.now()}`, text },
      ])
      pendingUserMessageRef.current = text
      // Skip any unsubmitted exercises to unblock the current turn
      const pending = displayItemsRef.current.filter(
        (i): i is Extract<DisplayItem, { kind: 'exercise' }> =>
          i.kind === 'exercise' && !i.submitted,
      )
      for (const item of pending) skipExercise(item.toolCallId)
    },
    [sendMessage, skipExercise],
  )

  const submitExerciseResult = useCallback((toolCallId: string, result: unknown) => {
    setDisplayItems(prev =>
      prev.map(item =>
        item.kind === 'exercise' && item.toolCallId === toolCallId
          ? { ...item, submitted: true, result }
          : item,
      ),
    )

    const item = displayItemsRef.current.find(
      i => i.kind === 'exercise' && i.toolCallId === toolCallId,
    )
    if (item?.kind === 'exercise') {
      configRef.current.onExerciseResult?.(item.toolName, item.input, result)
    }

    fetch(configRef.current.toolEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolCallId, result }),
    }).catch(err => console.error('Tool result POST failed:', err))
  }, [])

  return { displayItems, isStreaming, sendUserMessage, submitExerciseResult }
}
