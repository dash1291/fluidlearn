'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@/framework/types'

interface TranslationInput {
  prompt: string
  direction: 'to_target' | 'to_native'
  correct_answer: string
  acceptable_answers?: string[]
}

interface TranslationResult {
  answer: string
  is_correct: boolean
}

const normalize = (s: string) => s.trim().toLowerCase().normalize('NFC').replace(/[.,!?¿¡]/g, '')

function checkAnswer(answer: string, input: TranslationInput): boolean {
  const norm = normalize(answer)
  if (norm === normalize(input.correct_answer)) return true
  return input.acceptable_answers?.some(a => normalize(a) === norm) ?? false
}

export function TranslationChallenge({ input, submitted, result, onSubmit }: ExerciseComponentProps<TranslationInput, TranslationResult>) {
  const [answer, setAnswer] = useState(result?.answer ?? '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skipped = !!(result as any)?.skipped

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Translation</span>
        <span className="direction-label">
          {input.direction === 'to_target' ? 'Translate to target language' : 'Translate to English'}
        </span>
      </div>
      <p className="prompt-text">{input.prompt}</p>
      {!submitted ? (
        <textarea
          className="translation-input"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type your translation..."
          rows={2}
          autoFocus
        />
      ) : skipped ? (
        <div className="translation-result result-skipped">—</div>
      ) : (
        <div className={`translation-result ${result?.is_correct ? 'result-correct' : 'result-wrong'}`}>
          {answer}
        </div>
      )}
      {!submitted && (
        <button className="btn-primary" onClick={() => onSubmit({ answer: answer.trim(), is_correct: checkAnswer(answer, input) })} disabled={!answer.trim()}>
          Check
        </button>
      )}
      {submitted && !skipped && !result?.is_correct && (
        <p className="correction-text">Correct: <strong>{input.correct_answer}</strong></p>
      )}
    </div>
  )
}
