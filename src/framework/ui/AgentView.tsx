'use client'

import { useEffect, useRef, useState } from 'react'
import type { AgentConfig, ComponentRegistry } from '../types'
import { useAgent } from '../hooks/useAgent'
import { MessageBubble } from './MessageBubble'
import { ComponentHost } from './ComponentHost'

interface Props {
  agentConfig: AgentConfig
  registry: ComponentRegistry
  placeholder?: string
}

export function AgentView({ agentConfig, registry, placeholder = 'Message your tutor...' }: Props) {
  const { displayItems, isStreaming, sendUserMessage, submitExerciseResult } =
    useAgent(agentConfig)

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayItems])

  // Allow steering the agent while waiting for exercise input
  const hasPendingExercises = displayItems.some(i => i.kind === 'exercise' && !i.submitted)
  const inputBlocked = isStreaming && !hasPendingExercises

  const handleSend = () => {
    const text = input.trim()
    if (!text || inputBlocked) return
    setInput('')
    sendUserMessage(text)
  }

  return (
    <div className="conversation-container">
      <div className="conversation-scroll">
        {displayItems.map(item => {
          if (item.kind === 'user_message') {
            return <MessageBubble key={item.id} role="user" text={item.text} />
          }
          if (item.kind === 'assistant_text') {
            return (
              <MessageBubble
                key={item.id}
                role="assistant"
                text={item.text}
                isStreaming={item.isStreaming}
              />
            )
          }
          if (item.kind === 'exercise') {
            return (
              <div key={item.id} className="exercise-wrapper">
                <ComponentHost item={item} registry={registry} onSubmit={submitExerciseResult} />
              </div>
            )
          }
          return null
        })}

        {isStreaming && displayItems.every(i => i.kind !== 'assistant_text' || !i.isStreaming) && (
          <div className="message-row message-row-assistant">
            <div className="bubble-assistant bubble-thinking">
              <span className="dot-flashing" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={placeholder}
          disabled={inputBlocked}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!input.trim() || inputBlocked}
        >
          Send
        </button>
      </div>
    </div>
  )
}
