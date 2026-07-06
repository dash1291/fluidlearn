'use client'

import { useEffect, useRef } from 'react'
import type { ExerciseComponentProps } from '@fluid/ui'

interface Milestone {
  id: string
  title: string
  description?: string
  status?: string
}

interface LearningPlanInput {
  goal?: string
  isDefault?: boolean
  milestones?: Milestone[]
  // update_learning_plan payload
  completedMilestoneId?: string
}

export function LearningPlanCard({
  input,
  submitted,
  onSubmit,
}: ExerciseComponentProps<LearningPlanInput, { accepted: boolean }>) {
  const milestones = input.milestones ?? []
  // No milestones means this is a progress update, not a new plan.
  const isUpdate = milestones.length === 0

  // Progress updates carry nothing for the user to confirm — acknowledge them
  // automatically so the lesson continues without a click. The ref guard avoids
  // a double submit under React StrictMode's dev remount.
  const acknowledged = useRef(false)
  useEffect(() => {
    if (!isUpdate || submitted || acknowledged.current) return
    acknowledged.current = true
    onSubmit({ accepted: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isUpdate) {
    return (
      <div className="exercise-card">
        <div className="exercise-card-header">
          <span className="exercise-label">Progress</span>
        </div>
        <p style={{ margin: 0 }}>✓ Milestone complete — moving on.</p>
      </div>
    )
  }

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Learning Plan</span>
      </div>

      <h3 style={{ fontWeight: 600, marginBottom: '12px' }}>{input.goal}</h3>

      <div className="space-y-2">
        {milestones.map((m, index) => (
          <div
            key={m.id}
            style={{
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              marginBottom: '8px',
            }}
          >
            <div>
              {index + 1}. {m.title}
            </div>

            {m.description && (
              <div
                style={{
                  fontSize: '0.9rem',
                  opacity: 0.8,
                }}
              >
                {m.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {!submitted && (
        <button
          className="btn-rating-good"
          onClick={() =>
            onSubmit({
              accepted: true,
            })
          }
        >
          Start Learning
        </button>
      )}

      {submitted && (
        <p className="submitted-label">
          Learning plan accepted
        </p>
      )}
    </div>
  )
}
