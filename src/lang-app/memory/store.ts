import type { IMemoryStore } from '@/framework/memory/types'
import { lsGet, lsSet } from '@/framework/memory/localStorage'
import type { LanguageMemoryData, WordRecord } from './types'

function storageKey(language: string) {
  return `fluid_lang_${language}`
}

function emptyData(): LanguageMemoryData {
  return {
    sessionCount: 0,
    lastSessionDate: null,
    totalExercises: 0,
    totalCorrect: 0,
    inferredLevel: 'beginner',
    words: {},
    userPreferences: null,
  }
}

function inferLevel(data: LanguageMemoryData): LanguageMemoryData['inferredLevel'] {
  if (data.sessionCount >= 20 && data.totalCorrect / Math.max(data.totalExercises, 1) > 0.75) {
    return 'advanced'
  }
  if (data.sessionCount >= 5) return 'intermediate'
  return 'beginner'
}

// Extract the word being practiced from a tool call
function extractWord(toolName: string, input: Record<string, unknown>): string | null {
  switch (toolName) {
    case 'show_flashcard':
      return typeof input.front === 'string' ? input.front : null
    case 'show_fill_blank':
      return typeof input.correct_answer === 'string' ? input.correct_answer : null
    default:
      return null
  }
}

function isCorrectResult(toolName: string, result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const r = result as Record<string, unknown>

  if (toolName === 'show_flashcard') {
    return r.rating === 'good' || r.rating === 'easy'
  }
  return r.is_correct === true
}

export class LanguageMemoryStore implements IMemoryStore {
  private language: string
  private sessionExercises = 0
  private sessionCorrect = 0

  constructor(language: string, initialData?: LanguageMemoryData) {
    this.language = language
    // Seed localStorage from server-fetched data only if nothing is stored locally yet
    if (initialData && !lsGet<LanguageMemoryData>(storageKey(language))) {
      lsSet(storageKey(language), initialData)
    }
  }

  getData(): LanguageMemoryData | null {
    return lsGet<LanguageMemoryData>(storageKey(this.language))
  }

  getContext(): string | null {
    const data = lsGet<LanguageMemoryData>(storageKey(this.language))
    if (!data || data.sessionCount === 0) return null

    const weakWords = Object.entries(data.words)
      .filter(([, w]) => w.incorrectCount > w.correctCount)
      .sort((a, b) => b[1].incorrectCount - a[1].incorrectCount)
      .slice(0, 8)
      .map(([word]) => word)

    const daysSinceLast = data.lastSessionDate
      ? Math.floor((Date.now() - data.lastSessionDate) / 86_400_000)
      : null

    const lines = [
      `Sessions completed: ${data.sessionCount}`,
      `Inferred level: ${inferLevel(data)}`,
      data.userPreferences ? `Learner preferences:\n${data.userPreferences}` : null,
      weakWords.length > 0 ? `Words to revisit: ${weakWords.join(', ')}` : null,
      daysSinceLast !== null ? `Days since last session: ${daysSinceLast}` : null,
    ].filter(Boolean)

    return lines.join('\n')
  }

  recordExerciseResult(
    toolName: string,
    input: Record<string, unknown>,
    result: unknown,
  ): void {
    this.sessionExercises++
    const correct = isCorrectResult(toolName, result)
    if (correct) this.sessionCorrect++

    const word = extractWord(toolName, input)
    if (!word) return

    const data = lsGet<LanguageMemoryData>(storageKey(this.language)) ?? emptyData()
    const existing: WordRecord = data.words[word] ?? {
      correctCount: 0,
      incorrectCount: 0,
      lastSeen: Date.now(),
    }

    data.words[word] = {
      correctCount: existing.correctCount + (correct ? 1 : 0),
      incorrectCount: existing.incorrectCount + (correct ? 0 : 1),
      lastSeen: Date.now(),
    }

    lsSet(storageKey(this.language), data)
  }

  getPreferences(): string | null {
    const data = lsGet<LanguageMemoryData>(storageKey(this.language))
    return data?.userPreferences ?? null
  }

  updatePreferences(preferences: string): void {
    const data = lsGet<LanguageMemoryData>(storageKey(this.language)) ?? emptyData()
    data.userPreferences = preferences
    lsSet(storageKey(this.language), data)
  }

  endSession(): void {
    if (this.sessionExercises === 0) return

    const data = lsGet<LanguageMemoryData>(storageKey(this.language)) ?? emptyData()

    data.sessionCount++
    data.lastSessionDate = Date.now()
    data.totalExercises += this.sessionExercises
    data.totalCorrect += this.sessionCorrect
    data.inferredLevel = inferLevel(data)

    lsSet(storageKey(this.language), data)

    this.sessionExercises = 0
    this.sessionCorrect = 0
  }
}
