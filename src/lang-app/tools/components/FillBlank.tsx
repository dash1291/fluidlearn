'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@/framework/types'

interface FillBlankInput {
  sentence_template: string
  correct_answer: string
  hint?: string
  translation?: string
}

interface FillBlankResult {
  answer: string
  is_correct: boolean
}

const normalize = (s: string) => s.trim().toLowerCase()

export function FillBlank({ input, submitted, result, onSubmit }: ExerciseComponentProps<FillBlankInput, FillBlankResult>) {
  const [answer, setAnswer] = useState(result?.answer ?? '')
  const parts = input.sentence_template.split('___')

  const handleSubmit = () => {
    if (!answer.trim()) return
    onSubmit({ answer: answer.trim(), is_correct: normalize(answer) === normalize(input.correct_answer) })
  }

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Fill in the Blank</span>
      </div>
      <div className="fill-sentence">
        <span>{parts[0]}</span>
        {submitted ? (
          <span className={result?.is_correct ? 'blank-correct' : 'blank-wrong'}>
            {result?.is_correct ? answer : input.correct_answer}
          </span>
        ) : (
          <input
            className="blank-input"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        )}
        <span>{parts[1]}</span>
      </div>
      {input.translation && <p className="translation-hint">{input.translation}</p>}
      {input.hint && !submitted && <p className="exercise-hint">Hint: {input.hint}</p>}
      {!submitted && (
        <button className="btn-primary" onClick={handleSubmit} disabled={!answer.trim()}>Check</button>
      )}
      {submitted && !result?.is_correct && (
        <p className="correction-text">Correct answer: <strong>{input.correct_answer}</strong></p>
      )}
    </div>
  )
}
