'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@/framework/types'

interface ArrangeInput {
  words: string[]
  correct_order: string[]
  translation?: string
}

interface ArrangeResult {
  order: string[]
  is_correct: boolean
}

export function SentenceArrange({ input, submitted, result, onSubmit }: ExerciseComponentProps<ArrangeInput, ArrangeResult>) {
  const [available, setAvailable] = useState(() => [...input.words])
  const [arranged, setArranged] = useState<string[]>([])

  const addWord = (word: string, idx: number) => {
    if (submitted) return
    setAvailable(prev => prev.filter((_, i) => i !== idx))
    setArranged(prev => [...prev, word])
  }

  const removeWord = (word: string, idx: number) => {
    if (submitted) return
    setArranged(prev => prev.filter((_, i) => i !== idx))
    setAvailable(prev => [...prev, word])
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[.,!?;:]/g, '').trim()

  const handleSubmit = () => {
    const is_correct =
      arranged.length === input.correct_order.length &&
      arranged.every((w, i) => normalize(w) === normalize(input.correct_order[i]))
    onSubmit({ order: arranged, is_correct })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skipped = !!(result as any)?.skipped
  const displayWords = submitted && result
    ? (skipped ? [] : result.is_correct ? arranged : input.correct_order)
    : arranged

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Arrange</span>
      </div>
      {input.translation && <p className="translation-hint">{input.translation}</p>}
      <div className="arrange-drop-zone">
        {displayWords.length === 0 && !submitted && (
          <span className="arrange-placeholder">Tap words below to build the sentence</span>
        )}
        {displayWords.length === 0 && submitted && skipped && (
          <span className="arrange-placeholder" style={{ opacity: 0.5 }}>—</span>
        )}
        {displayWords.map((word, idx) => (
          <button
            key={`${word}-${idx}`}
            className={submitted ? (result?.is_correct ? 'word-chip-correct' : 'word-chip-wrong') : 'word-chip-placed'}
            onClick={() => removeWord(word, idx)}
            disabled={submitted}
          >
            {word}
          </button>
        ))}
      </div>
      {!submitted && (
        <div className="arrange-available">
          {available.map((word, idx) => (
            <button key={`${word}-${idx}`} className="word-chip-available" onClick={() => addWord(word, idx)}>
              {word}
            </button>
          ))}
        </div>
      )}
      {!submitted && (
        <button className="btn-primary" onClick={handleSubmit} disabled={arranged.length === 0}>Check</button>
      )}
      {submitted && !skipped && !result?.is_correct && (
        <p className="correction-text">Correct order: <strong>{input.correct_order.join(' ')}</strong></p>
      )}
    </div>
  )
}
