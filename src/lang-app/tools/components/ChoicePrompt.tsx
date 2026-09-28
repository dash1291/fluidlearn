'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@fluid/ui'

interface ChoiceOption {
  label: string
  description?: string
}

interface ChoiceInput {
  question: string
  options: ChoiceOption[]
}

interface ChoiceResult {
  choice: string
}

export function ChoicePrompt({
  input,
  submitted,
  result,
  onSubmit,
}: ExerciseComponentProps<ChoiceInput, ChoiceResult>) {
  const [selected, setSelected] = useState<string | null>(result?.choice ?? null)

  const pick = (label: string) => {
    if (submitted) return
    setSelected(label)
    onSubmit({ choice: label })
  }

  return (
    <div className="exercise-card">
      <p className="question-text">{input.question}</p>
      <div className="options-list">
        {input.options.map(opt => (
          <button
            key={opt.label}
            className={
              submitted
                ? selected === opt.label
                  ? 'option-selected option-disabled'
                  : 'option-default option-disabled'
                : 'option-default'
            }
            onClick={() => pick(opt.label)}
            disabled={submitted}
          >
            <span>
              <span>{opt.label}</span>
              {opt.description && <span className="choice-description">{opt.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
