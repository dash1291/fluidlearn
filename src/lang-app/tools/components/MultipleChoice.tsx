'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@/framework/types'

interface MultipleChoiceInput {
  question: string
  options: string[]
  correct_index: number
  explanation?: string
}

interface MultipleChoiceResult {
  selected_index: number
  is_correct: boolean
}

export function MultipleChoice({
  input,
  submitted,
  result,
  onSubmit,
}: ExerciseComponentProps<MultipleChoiceInput, MultipleChoiceResult>) {
  const [selected, setSelected] = useState<number | null>(result?.selected_index ?? null)

  const handleSelect = (idx: number) => {
    if (submitted) return
    setSelected(idx)
    onSubmit({ selected_index: idx, is_correct: idx === input.correct_index })
  }

  const getOptionClass = (idx: number) => {
    if (!submitted) return selected === idx ? 'option-selected' : 'option-default'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((result as any)?.skipped) return 'option-default option-disabled'
    if (idx === input.correct_index) return 'option-correct'
    if (idx === selected && idx !== input.correct_index) return 'option-wrong'
    return 'option-default option-disabled'
  }

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Multiple Choice</span>
      </div>
      <p className="question-text">{input.question}</p>
      <div className="options-list">
        {input.options.map((opt, idx) => (
          <button key={idx} className={getOptionClass(idx)} onClick={() => handleSelect(idx)} disabled={submitted}>
            <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
            <span>{opt}</span>
          </button>
        ))}
      </div>
      {submitted && input.explanation && <p className="explanation-text">{input.explanation}</p>}
    </div>
  )
}
