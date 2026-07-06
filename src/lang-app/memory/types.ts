export interface WordRecord {
  correctCount: number
  incorrectCount: number
  lastSeen: number
}

export interface Milestone {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface LearningPlan {
  goal: string
  isDefault: boolean
  milestones: Milestone[]
  currentMilestoneId: string | null
  createdAt: number
  updatedAt: number
}

export interface LanguageMemoryData {
  sessionCount: number
  lastSessionDate: number | null
  totalExercises: number
  totalCorrect: number
  inferredLevel: 'beginner' | 'intermediate' | 'advanced'
  words: Record<string, WordRecord>
  userPreferences: string | null
  totalStudyTimeSeconds: number
  learningPlan: LearningPlan | null
}
