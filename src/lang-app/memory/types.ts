export interface WordRecord {
  correctCount: number
  incorrectCount: number
  lastSeen: number
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
}
