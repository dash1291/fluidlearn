export interface WordRecord {
  correctCount: number
  incorrectCount: number
  lastSeen: number
}

export type ProgressStatus = 'pending' | 'in_progress' | 'completed'

export interface Phrase {
  native: string
  romanized: string
  english: string
  note?: string
}

export interface GrammarPattern {
  pattern: string
  meaning: string
  examples: Phrase[]
  trap?: string
  buildsOn?: string
}

export interface DialogueLine {
  speaker: string
  native: string
  romanized: string
  english: string
}

export interface UnitDetail {
  goalPhrases: Phrase[]
  grammar: GrammarPattern[]
  vocabulary: Phrase[]
  productionTasks: string[]
  dialogue: DialogueLine[]
  exerciseProgression: string[]
  pitfalls: string[]
  uncertainties: string[]
}

export interface Unit {
  id: string
  title: string
  objectives: string[]
  masteryCriteria: string[]
  buildsOn?: string[]
  detail?: UnitDetail
  status: ProgressStatus
}

export interface Milestone {
  id: string
  title: string
  description?: string
  status: ProgressStatus
  units?: Unit[]
}

// What the learner told the tutor before the plan was commissioned. Every
// field is optional; the designer applies defaults for anything missing.
export interface LearnerBrief {
  timeAvailable?: string
  register?: string
  prioritySituations?: string[]
  exclusions?: string[]
  notes?: string
}

export interface LearningPlan {
  goal: string
  isDefault: boolean
  level?: string
  brief?: LearnerBrief
  pronunciationRules?: string[]
  cultureNotes?: string[]
  milestones: Milestone[]
  currentMilestoneId: string | null
  currentUnitId?: string | null
  designedBy?: string
  createdAt: number
  updatedAt: number
}

export type DesignedUnit = Omit<Unit, 'status'>

export interface DesignedMilestone {
  id: string
  title: string
  description: string
  units: DesignedUnit[]
}

export interface DesignedPlan {
  goal: string
  isDefault: boolean
  level: string
  brief: LearnerBrief
  pronunciationRules: string[]
  cultureNotes: string[]
  milestones: DesignedMilestone[]
  designedBy: string
}

export interface VocabularyEntry {
  word: string
  translation: string
  pronunciation?: string
  firstSeen: number
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
  vocabulary?: Record<string, VocabularyEntry>
}
