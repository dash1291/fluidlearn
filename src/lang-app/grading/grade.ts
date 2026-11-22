export interface WordDifference {
  position: number
  expected: string | null
  got: string | null
}

// `wrong` is final. `unlisted` means the answer is not one the tutor listed,
// which for a sentence does not make it wrong; the tutor judges the meaning.
export type Verdict =
  | { kind: 'exact'; matched: string }
  | { kind: 'variant'; matched: string; differences: string[] }
  | { kind: 'wrong'; expected: string; firstDifference?: WordDifference }
  | { kind: 'unlisted'; expected: string; firstDifference?: WordDifference }

export interface Graded {
  verdict: Verdict
  is_correct?: boolean
}

interface Fold {
  name: string
  apply: (s: string) => string
}

const ACCENTS: Fold = {
  name: 'accent marks',
  // Latin combining marks only; Indic vowel signs are also category M.
  apply: s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC'),
}

const SPACING: Fold = { name: 'word spacing', apply: s => s.replace(/\s+/g, '') }

// Spellings a learner typing romanized Tamil uses for the same word. Order
// matters: doubled letters are collapsed after the other folds have run.
const TAMIL_FOLDS: Fold[] = [
  {
    name: 'vowel length',
    apply: s =>
      s
        .replace(/ā/g, 'a')
        .replace(/ī/g, 'i')
        .replace(/ū/g, 'u')
        .replace(/ē/g, 'e')
        .replace(/ō/g, 'o')
        .replace(/aa/g, 'a')
        .replace(/ii|ee/g, 'i')
        .replace(/uu|oo/g, 'u'),
  },
  { name: 'ai/ei', apply: s => s.replace(/ei/g, 'ai') },
  { name: 'th/dh or t/d', apply: s => s.replace(/dh/g, 'th').replace(/d/g, 't') },
  { name: 'k/g', apply: s => s.replace(/g/g, 'k') },
  { name: 'p/b', apply: s => s.replace(/b/g, 'p') },
  { name: 'v/w', apply: s => s.replace(/w/g, 'v') },
  { name: 'zh/l', apply: s => s.replace(/zh|ḻ|ḷ/g, 'l') },
  { name: 'n variants', apply: s => s.replace(/[ṇṉṅñ]/g, 'n') },
  ACCENTS,
  { name: 'doubled letters', apply: s => s.replace(/([^aeiou\s])\1+/g, '$1') },
  SPACING,
]

const DEFAULT_FOLDS: Fold[] = [ACCENTS, SPACING]

function foldsFor(language: string | undefined): Fold[] {
  return language === 'tamil' ? TAMIL_FOLDS : DEFAULT_FOLDS
}

function basic(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fold(s: string, folds: Fold[], except?: Fold): string {
  return folds.reduce((acc, f) => (f === except ? acc : f.apply(acc)), s)
}

function firstWordDifference(expected: string, got: string, folds: Fold[]): WordDifference | undefined {
  const e = basic(expected).split(' ')
  const g = basic(got).split(' ')
  if (e.length < 2 && g.length < 2) return undefined
  for (let i = 0; i < Math.max(e.length, g.length); i++) {
    if (e[i] === undefined || g[i] === undefined || fold(e[i], folds) !== fold(g[i], folds)) {
      return { position: i + 1, expected: e[i] ?? null, got: g[i] ?? null }
    }
  }
  return undefined
}

function compare(language: string | undefined, answer: string, accepted: string[], final: boolean): Graded {
  const folds = foldsFor(language)
  const typed = basic(answer)

  const exact = accepted.find(a => basic(a) === typed)
  if (exact !== undefined) return { verdict: { kind: 'exact', matched: exact }, is_correct: true }

  const variant = accepted.find(a => fold(basic(a), folds) === fold(typed, folds))
  if (variant !== undefined) {
    const differences = folds
      .filter(f => fold(basic(variant), folds, f) !== fold(typed, folds, f))
      .map(f => f.name)
    return { verdict: { kind: 'variant', matched: variant, differences }, is_correct: true }
  }

  const expected = accepted[0]
  const firstDifference = firstWordDifference(expected, answer, folds)
  const detail = { expected, ...(firstDifference ? { firstDifference } : {}) }
  return final ? { verdict: { kind: 'wrong', ...detail }, is_correct: false } : { verdict: { kind: 'unlisted', ...detail } }
}

export function gradeFillBlank(
  language: string | undefined,
  input: { correct_answer: string },
  answer: string,
): Graded {
  return compare(language, answer, [input.correct_answer], true)
}

// Returns null for translations into English, which code cannot judge. A
// mismatch is final only for answers of at most two words, the same boundary
// the memory store uses for what counts as vocabulary.
export function gradeTranslation(
  language: string | undefined,
  input: { direction: 'to_target' | 'to_native'; correct_answer: string; acceptable_answers?: string[] },
  answer: string,
): Graded | null {
  if (input.direction !== 'to_target') return null
  const final = input.correct_answer.trim().split(/\s+/).length <= 2
  return compare(language, answer, [input.correct_answer, ...(input.acceptable_answers ?? [])], final)
}

export interface ChoiceGraded {
  is_correct: boolean
  selected: string
  correct: string
}

export function gradeChoice(input: { options: string[]; correct_index: number }, selectedIndex: number): ChoiceGraded {
  return {
    is_correct: selectedIndex === input.correct_index,
    selected: input.options[selectedIndex],
    correct: input.options[input.correct_index],
  }
}

// Word order is free in several of the languages taught, so an order other
// than the listed one is reported without is_correct for the tutor to judge.
// Leaving words unused is wrong.
export type ArrangeGraded =
  | { arrangement: 'listed'; is_correct: true }
  | { arrangement: 'incomplete'; is_correct: false; used: number; total: number }
  | { arrangement: 'other_order'; firstDifference: WordDifference }

export function gradeArrange(input: { correct_order: string[] }, order: string[]): ArrangeGraded {
  const expected = input.correct_order
  if (order.length < expected.length) {
    return { arrangement: 'incomplete', is_correct: false, used: order.length, total: expected.length }
  }
  const index = expected.findIndex((w, i) => basic(w) !== basic(order[i] ?? ''))
  if (index === -1) return { arrangement: 'listed', is_correct: true }
  return {
    arrangement: 'other_order',
    firstDifference: { position: index + 1, expected: expected[index], got: order[index] ?? null },
  }
}
