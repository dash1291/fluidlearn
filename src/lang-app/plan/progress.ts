import type { LearningPlan, Milestone, Unit } from '@/lang-app/memory/types'

export interface UnitLocation {
  milestone: Milestone
  unit: Unit
}

export function findUnit(plan: LearningPlan, unitId: string): UnitLocation | null {
  for (const milestone of plan.milestones) {
    const unit = milestone.units?.find(u => u.id === unitId)
    if (unit) return { milestone, unit }
  }
  return null
}

// The unit that becomes current once `unitId` is completed: the next
// unfinished unit in the same milestone, else the first unit of the next
// milestone that has any. Null when the roadmap is exhausted.
export function nextUnitAfter(plan: LearningPlan, unitId: string): UnitLocation | null {
  const found = findUnit(plan, unitId)
  if (!found) return null

  const sibling = found.milestone.units!.find(u => u.id !== unitId && u.status !== 'completed')
  if (sibling) return { milestone: found.milestone, unit: sibling }

  const index = plan.milestones.indexOf(found.milestone)
  for (const milestone of plan.milestones.slice(index + 1)) {
    const unit = milestone.units?.find(u => u.status !== 'completed')
    if (unit) return { milestone, unit }
  }
  return null
}
