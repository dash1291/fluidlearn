'use client'

interface Props {
  role: 'user' | 'assistant'
  text: string
  isStreaming?: boolean
}

export function MessageBubble({ role, text, isStreaming }: Props) {
  if (!text && !isStreaming) return null

  return (
    <div className={`message-row ${role === 'user' ? 'message-row-user' : 'message-row-assistant'}`}>
      <div className={role === 'user' ? 'bubble-user' : 'bubble-assistant'}>
        {text}
        {isStreaming && <span className="streaming-cursor" />}
      </div>
    </div>
  )
}
