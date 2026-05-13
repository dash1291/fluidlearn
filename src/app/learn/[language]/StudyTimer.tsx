'use client'

import { useEffect, useState } from 'react'

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface Props {
  initialTotalSeconds: number
}

export function StudyTimer({ initialTotalSeconds }: Props) {
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(initialTotalSeconds)

  useEffect(() => {
    let lastTime = Date.now()
    let id = 0

    const tick = () => {
      if (!document.hidden) {
        const now = Date.now()
        const delta = Math.floor((now - lastTime) / 1000)
        if (delta > 0) {
          setSessionSeconds(prev => prev + delta)
          setTotalSeconds(prev => prev + delta)
          lastTime = now
        }
      }
      id = requestAnimationFrame(tick)
    }

    id = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="study-timer">
      <span className="study-timer-session">{formatSeconds(sessionSeconds)}</span>
      <span className="study-timer-divider">/</span>
      <span className="study-timer-total" title="Total study time">
        {formatSeconds(totalSeconds)}
      </span>
    </div>
  )
}
