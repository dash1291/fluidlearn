'use client'

import { useEffect, useRef } from 'react'
import type { ExerciseComponentProps } from '@fluid/ui'
import type { DesignedMilestone } from '@/lang-app/memory/types'

interface LearningPlanInput {
  goal?: string
  level?: string
  milestones?: DesignedMilestone[]
  completedUnitId?: string
  completedMilestoneId?: string
  nextUnitId?: string
}

export function LearningPlanCard({
  input,
  submitted,
  onSubmit,
}: ExerciseComponentProps<LearningPlanInput, { accepted: boolean }>) {
  const milestones = input.milestones ?? []
  // A plan request replayed from history carries only the tutor's inputs, not
  // the designed milestones; a progress update carries neither.
  const isPlan = milestones.length > 0
  const isReplayedPlan = !isPlan && typeof input.goal === 'string'
  const isUpdate = !isPlan && !isReplayedPlan

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
        <p style={{ margin: 0 }}>
          ✓ {input.completedMilestoneId ? 'Milestone' : 'Unit'} complete{input.nextUnitId ? ' — next unit ready.' : '.'}
        </p>
      </div>
    )
  }

  if (isReplayedPlan) {
    return (
      <div className="exercise-card">
        <div className="exercise-card-header">
          <span className="exercise-label">Learning Plan</span>
        </div>
        <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>{input.goal}</h3>
        {submitted ? (
          <p className="submitted-label">Learning plan accepted</p>
        ) : (
          <button className="btn-rating-good" onClick={() => onSubmit({ accepted: true })}>
            Continue
          </button>
        )}
      </div>
    )
  }

  const unitCount = milestones.reduce((n, m) => n + m.units.length, 0)

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Learning Plan</span>
      </div>

      <h3 style={{ fontWeight: 600, marginBottom: '4px' }}>{input.goal}</h3>
      <p style={{ margin: '0 0 12px', fontSize: '0.9rem', opacity: 0.7 }}>
        {milestones.length} milestones, {unitCount} units
        {input.level ? ` · starting from: ${input.level}` : ''}
      </p>

      <div>
        {milestones.map((m, index) => (
          <div
            key={m.id}
            style={{
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontWeight: 500 }}>
              {index + 1}. {m.title}
            </div>
            {m.description && (
              <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '2px' }}>{m.description}</div>
            )}
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '0.9rem', opacity: 0.85 }}>
              {m.units.map(u => (
                <li key={u.id}>{u.title}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {!submitted && (
        <button className="btn-rating-good" onClick={() => onSubmit({ accepted: true })}>
          Start Learning
        </button>
      )}

      {submitted && <p className="submitted-label">Learning plan accepted</p>}
    </div>
  )
}
