import type { IMemoryStore } from '@fluid/ui'
import { lsGet, lsSet } from '@fluid/ui'
import type {
  LanguageMemoryData,
  WordRecord,
  LearningPlan,
  DesignedPlan,
  Milestone,
  Unit,
  UnitDetail,
  Phrase,
  VocabularyEntry,
} from './types'
import { findUnit, nextUnitAfter } from '@/lang-app/plan/progress'

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
    totalStudyTimeSeconds: 0,
    learningPlan: null,
  }
}

function inferLevel(data: LanguageMemoryData): LanguageMemoryData['inferredLevel'] {
  if (data.sessionCount >= 20 && data.totalCorrect / Math.max(data.totalExercises, 1) > 0.75) {
    return 'advanced'
  }
  if (data.sessionCount >= 5) return 'intermediate'
  return 'beginner'
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

// The word being practised in a tool call, with its English meaning. Whole
// sentences are not vocabulary, so translation exercises count only when the
// answer is at most two words.
function extractWord(toolName: string, input: Record<string, unknown>): { word: string; meaning?: string } | null {
  switch (toolName) {
    case 'show_flashcard': {
      const word = str(input.front)
      return word ? { word, meaning: str(input.back) } : null
    }
    case 'show_fill_blank': {
      const word = str(input.correct_answer)
      return word ? { word, meaning: str(input.answer_meaning) } : null
    }
    case 'show_translation': {
      const word = str(input.correct_answer)
      if (!word || input.direction !== 'to_target' || word.trim().split(/\s+/).length > 2) return null
      return { word, meaning: str(input.prompt) }
    }
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

function lastActivity(data: LanguageMemoryData): number {
  const wordTimes = Object.values(data.words ?? {}).map(w => w.lastSeen)
  return Math.max(data.lastSessionDate ?? 0, data.learningPlan?.updatedAt ?? 0, ...wordTimes)
}

const STATUS_ICON = { completed: '✓', in_progress: '▶', pending: '○' } as const

function bulletList(items: string[]): string {
  return items.map(i => `  - ${i}`).join('\n')
}

function formatPhrase(p: Phrase): string {
  return `${p.native} (${p.romanized}) — ${p.english}${p.note ? ` [${p.note}]` : ''}`
}

function formatUnitSpec(unit: Unit): string {
  const d = unit.detail
  const sections = [
    `Current unit [${unit.id}]: ${unit.title}`,
    unit.objectives.length ? `Objectives:\n${bulletList(unit.objectives)}` : null,
    d?.goalPhrases?.length ? `Goal phrases (what the learner must be able to say by the end):\n${bulletList(d.goalPhrases.map(formatPhrase))}` : null,
    d?.grammar?.length
      ? `Rules the goal phrases run on:\n${d.grammar
          .map(
            g =>
              `  * ${g.pattern} — ${g.meaning}${g.buildsOn ? ` (builds on ${g.buildsOn})` : ''}${g.trap ? `\n    Trap: ${g.trap}` : ''}\n${g.examples
                .map(e => `    - ${formatPhrase(e)}`)
                .join('\n')}`,
          )
          .join('\n')}`
      : null,
    d?.vocabulary?.length ? `Additional vocabulary:\n${bulletList(d.vocabulary.map(formatPhrase))}` : null,
    d?.productionTasks?.length
      ? `Production tasks (learner must build these, they appear in no table):\n${d.productionTasks.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
      : null,
    d?.dialogue?.length
      ? `Dialogue for role-play:\n${d.dialogue.map(l => `  ${l.speaker}: ${l.native} (${l.romanized}) — ${l.english}`).join('\n')}`
      : null,
    d?.exerciseProgression?.length
      ? `Suggested progression:\n${d.exerciseProgression.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
      : null,
    unit.masteryCriteria.length ? `Mastery criteria:\n${bulletList(unit.masteryCriteria)}` : null,
    d?.pitfalls?.length ? `Pitfalls for English speakers:\n${bulletList(d.pitfalls)}` : null,
    d?.uncertainties?.length ? `Flag once to the learner if relevant:\n${bulletList(d.uncertainties)}` : null,
    d ? null : 'This unit has no prepared phrases or progression; teach toward its objectives using your own judgement.',
  ]
  return sections.filter(Boolean).join('\n')
}

function formatRoadmap(plan: LearningPlan): string {
  return plan.milestones
    .map(m => {
      const line = `${STATUS_ICON[m.status]} [${m.id}] ${m.title}`
      if (m.status !== 'in_progress' || !m.units?.length) return line
      const units = m.units.map(u => `    ${STATUS_ICON[u.status]} [${u.id}] ${u.title}`).join('\n')
      return `${line}\n${units}`
    })
    .join('\n')
}

function activateMilestone(plan: LearningPlan, milestone: Milestone | undefined): void {
  if (!milestone) {
    plan.currentMilestoneId = null
    plan.currentUnitId = null
    return
  }
  milestone.status = 'in_progress'
  plan.currentMilestoneId = milestone.id
  const firstUnit = milestone.units?.find(u => u.status !== 'completed')
  if (firstUnit) firstUnit.status = 'in_progress'
  plan.currentUnitId = firstUnit?.id ?? null
}

export class LanguageMemoryStore implements IMemoryStore {
  private language: string
  private sessionExercises = 0
  private sessionCorrect = 0
  private studyStartTime: number | null = null

  // localStorage is the working copy; the server copy replaces it when it is
  // at least as recent, so progress made on another device is not shadowed.
  constructor(language: string, initialData?: LanguageMemoryData) {
    this.language = language
    if (!initialData) return
    const local = lsGet<LanguageMemoryData>(storageKey(language))
    if (!local || lastActivity(initialData) >= lastActivity(local)) {
      lsSet(storageKey(language), initialData)
    }
  }

  getData(): LanguageMemoryData | null {
    return lsGet<LanguageMemoryData>(storageKey(this.language))
  }

  getPlan(): LearningPlan | null {
    return this.getData()?.learningPlan ?? null
  }

  startStudyTimer(): void {
    this.studyStartTime = Date.now()
  }

  pauseStudyTimer(): number {
    if (!this.studyStartTime) return 0
    const elapsed = Math.floor((Date.now() - this.studyStartTime) / 1000)
    this.studyStartTime = null
    if (elapsed <= 0) return 0

    const data = this.getData() ?? emptyData()
    data.totalStudyTimeSeconds = (data.totalStudyTimeSeconds ?? 0) + elapsed
    lsSet(storageKey(this.language), data)
    return elapsed
  }

  getContext(): string | null {
    const data = this.getData()
    if (!data) return null
    // Brand-new learner with no plan yet — nothing useful to inject.
    if (data.sessionCount === 0 && !data.learningPlan) return null

    const weakWords = Object.entries(data.words)
      .filter(([, w]) => w.incorrectCount > w.correctCount)
      .sort((a, b) => b[1].incorrectCount - a[1].incorrectCount)
      .slice(0, 8)
      .map(([word]) => word)

    const daysSinceLast = data.lastSessionDate
      ? Math.floor((Date.now() - data.lastSessionDate) / 86_400_000)
      : null

    const plan = data.learningPlan
    const currentUnit =
      plan?.currentUnitId ? findUnit(plan, plan.currentUnitId)?.unit ?? null : null

    const lines = [
      data.sessionCount > 0 ? `Sessions completed: ${data.sessionCount}` : null,
      data.sessionCount > 0 ? `Inferred level: ${inferLevel(data)}` : null,
      data.userPreferences ? `Learner preferences:\n${data.userPreferences}` : null,
      weakWords.length > 0 ? `Words to revisit: ${weakWords.join(', ')}` : null,
      daysSinceLast !== null ? `Days since last session: ${daysSinceLast}` : null,
      plan ? `Current goal: ${plan.goal}` : null,
      plan?.pronunciationRules?.length ? `Pronunciation rules (teach briefly in the first unit, then just correct against them):\n${bulletList(plan.pronunciationRules)}` : null,
      plan?.cultureNotes?.length ? `Culture and etiquette for this goal:\n${bulletList(plan.cultureNotes)}` : null,
      plan ? `Roadmap (▶ = in progress):\n${formatRoadmap(plan)}` : null,
      currentUnit ? formatUnitSpec(currentUnit) : null,
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

    const entry = extractWord(toolName, input)
    if (!entry) return
    const { word } = entry

    const data = this.getData() ?? emptyData()
    const existing: WordRecord = data.words[word] ?? {
      correctCount: 0,
      incorrectCount: 0,
      lastSeen: Date.now(),
    }

    const fromExercise = entry.meaning ?? (existing.meaningSource === 'exercise' ? existing.meaning : undefined)
    const meaning = fromExercise ?? existing.meaning
    data.words[word] = {
      correctCount: existing.correctCount + (correct ? 1 : 0),
      incorrectCount: existing.incorrectCount + (correct ? 0 : 1),
      lastSeen: Date.now(),
      ...(meaning ? { meaning, meaningSource: fromExercise ? 'exercise' : existing.meaningSource } : {}),
    }

    lsSet(storageKey(this.language), data)
  }

  // A meaning supplied by the exercise itself is kept; a looked-up one may be
  // replaced by a later lookup.
  setWordMeanings(meanings: Record<string, string>): void {
    const data = this.getData()
    if (!data) return
    for (const [word, meaning] of Object.entries(meanings)) {
      const record = data.words[word]
      if (!record || record.meaningSource === 'exercise' || !meaning.trim()) continue
      record.meaning = meaning.trim()
      record.meaningSource = 'lookup'
    }
    lsSet(storageKey(this.language), data)
  }

  recordVocabulary(words: { word: string; translation: string; pronunciation?: string }[]): void {
    const data = this.getData() ?? emptyData()
    const vocabulary = data.vocabulary ?? {}
    for (const w of words) {
      const key = w.word.trim().toLowerCase()
      if (!key || vocabulary[key]) continue
      vocabulary[key] = {
        word: w.word,
        translation: w.translation,
        ...(w.pronunciation ? { pronunciation: w.pronunciation } : {}),
        firstSeen: Date.now(),
      }
    }
    data.vocabulary = vocabulary
    lsSet(storageKey(this.language), data)
  }

  // Everything the learner has met so far: phrases from units they have
  // started, words shown on vocabulary cards, and words scored in exercises.
  getVocabulary(): {
    fromPlan: (Phrase & { unitId: string })[]
    fromCards: VocabularyEntry[]
    practised: { word: string; meaning: string | null; needsLookup: boolean; correct: number; incorrect: number }[]
  } {
    const data = this.getData()
    const fromPlan: (Phrase & { unitId: string })[] = []
    for (const m of data?.learningPlan?.milestones ?? []) {
      for (const u of m.units ?? []) {
        if (u.status === 'pending' || !u.detail) continue
        for (const p of [...u.detail.goalPhrases, ...u.detail.vocabulary]) fromPlan.push({ ...p, unitId: u.id })
      }
    }
    const fromCards = Object.values(data?.vocabulary ?? {}).sort((a, b) => a.firstSeen - b.firstSeen)

    const meanings = new Map<string, string>()
    for (const p of fromPlan) {
      meanings.set(p.native.trim().toLowerCase(), p.english)
      meanings.set(p.romanized.trim().toLowerCase(), p.english)
    }
    for (const c of fromCards) meanings.set(c.word.trim().toLowerCase(), c.translation)

    const practised = Object.entries(data?.words ?? {})
      .map(([word, w]) => ({
        word,
        meaning: w.meaning ?? meanings.get(word.trim().toLowerCase()) ?? null,
        // Meanings recorded before sources were tracked came from an unreliable
        // lookup and are checked once more.
        needsLookup: !w.meaning || !w.meaningSource,
        correct: w.correctCount,
        incorrect: w.incorrectCount,
      }))
      .sort((a, b) => b.incorrect - a.incorrect || b.correct - a.correct)
    return { fromPlan, fromCards, practised }
  }

  getPreferences(): string | null {
    return this.getData()?.userPreferences ?? null
  }

  updatePreferences(preferences: string): void {
    const data = this.getData() ?? emptyData()
    data.userPreferences = preferences
    lsSet(storageKey(this.language), data)
  }

  setPlan(designed: DesignedPlan): void {
    const data = this.getData() ?? emptyData()
    const now = Date.now()

    const plan: LearningPlan = {
      goal: designed.goal,
      isDefault: designed.isDefault,
      level: designed.level,
      brief: designed.brief,
      pronunciationRules: designed.pronunciationRules,
      cultureNotes: designed.cultureNotes,
      designedBy: designed.designedBy,
      milestones: designed.milestones.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        status: 'pending',
        units: m.units.map(u => ({ ...u, status: 'pending' as const })),
      })),
      currentMilestoneId: null,
      currentUnitId: null,
      createdAt: data.learningPlan?.createdAt ?? now,
      updatedAt: now,
    }
    activateMilestone(plan, plan.milestones[0])

    data.learningPlan = plan
    lsSet(storageKey(this.language), data)
  }

  completeUnit(unitId: string): void {
    const data = this.getData()
    const plan = data?.learningPlan
    if (!data || !plan) return

    const found = findUnit(plan, unitId)
    if (!found) return

    const next = nextUnitAfter(plan, unitId)
    found.unit.status = 'completed'
    if (!next || next.milestone !== found.milestone) {
      this.finishMilestone(data, plan, found.milestone)
      return
    }

    next.unit.status = 'in_progress'
    plan.currentUnitId = next.unit.id
    plan.currentMilestoneId = found.milestone.id
    plan.updatedAt = Date.now()
    lsSet(storageKey(this.language), data)
  }

  setUnitDetail(unitId: string, detail: UnitDetail): void {
    const data = this.getData()
    const plan = data?.learningPlan
    if (!data || !plan) return

    const found = findUnit(plan, unitId)
    if (!found) return

    found.unit.detail = detail
    plan.updatedAt = Date.now()
    lsSet(storageKey(this.language), data)
  }

  completeMilestone(id: string): void {
    const data = this.getData()
    const plan = data?.learningPlan
    if (!data || !plan) return

    const milestone = plan.milestones.find(m => m.id === id)
    if (!milestone) return

    this.finishMilestone(data, plan, milestone)
  }

  private finishMilestone(data: LanguageMemoryData, plan: LearningPlan, milestone: Milestone): void {
    milestone.status = 'completed'
    milestone.units?.forEach(u => {
      u.status = 'completed'
    })

    const index = plan.milestones.indexOf(milestone)
    activateMilestone(plan, plan.milestones[index + 1])

    plan.updatedAt = Date.now()
    lsSet(storageKey(this.language), data)
  }

  endSession(): void {
    if (this.sessionExercises === 0) return

    const data = this.getData() ?? emptyData()

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
