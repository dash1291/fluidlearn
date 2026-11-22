import { describe, expect, it } from 'vitest'
import { gradeArrange, gradeChoice, gradeFillBlank, gradeTranslation } from './grade'
import { formatExerciseResult } from './resultText'

describe('gradeFillBlank in Tamil', () => {
  it('accepts the answer regardless of case and punctuation', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'thanni' }, 'Thanni.')

    expect(graded).toEqual({ verdict: { kind: 'exact', matched: 'thanni' }, is_correct: true })
  })

  it('accepts "thaani" for "thanni" and names vowel length and doubling', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'thanni' }, 'thaani')

    expect(graded).toEqual({
      verdict: { kind: 'variant', matched: 'thanni', differences: ['vowel length', 'doubled letters'] },
      is_correct: true,
    })
  })

  it('accepts dh for th', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'vandhu' }, 'vanthu')

    expect(graded.verdict).toEqual({ kind: 'variant', matched: 'vandhu', differences: ['th/dh or t/d'] })
  })

  it('accepts g for k', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'vaanga' }, 'vaanka')

    expect(graded.verdict).toEqual({ kind: 'variant', matched: 'vaanga', differences: ['k/g'] })
  })

  it('accepts l for zh and names it', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'pazham' }, 'palam')

    expect(graded.verdict).toEqual({ kind: 'variant', matched: 'pazham', differences: ['zh/l'] })
  })

  it('accepts a macron for a doubled vowel', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'vaanga' }, 'vānga')

    expect(graded.verdict).toEqual({ kind: 'variant', matched: 'vaanga', differences: ['vowel length'] })
  })

  it('accepts a word typed as two', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'saapidalaam' }, 'saapida laam')

    expect(graded.verdict).toEqual({ kind: 'variant', matched: 'saapidalaam', differences: ['word spacing'] })
  })

  it('marks a different word wrong', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'thanni' }, 'paal')

    expect(graded).toEqual({ verdict: { kind: 'wrong', expected: 'thanni' }, is_correct: false })
  })

  it('compares native script exactly, vowel signs included', () => {
    const graded = gradeFillBlank('tamil', { correct_answer: 'கி' }, 'கு')

    expect(graded.is_correct).toBe(false)
  })
})

describe('gradeFillBlank in other languages', () => {
  it('does not fold k and g in Hindi', () => {
    const graded = gradeFillBlank('hindi', { correct_answer: 'ghar' }, 'khar')

    expect(graded.is_correct).toBe(false)
  })

  it('accepts a missing accent in Spanish and names it', () => {
    const graded = gradeFillBlank('spanish', { correct_answer: 'sí' }, 'si')

    expect(graded.verdict).toEqual({ kind: 'variant', matched: 'sí', differences: ['accent marks'] })
  })
})

describe('gradeTranslation', () => {
  it('does not grade a translation into English', () => {
    const graded = gradeTranslation('tamil', { direction: 'to_native', correct_answer: 'I want water' }, 'I need water')

    expect(graded).toBeNull()
  })

  it('matches one of the other acceptable answers', () => {
    const graded = gradeTranslation(
      'tamil',
      { direction: 'to_target', correct_answer: 'thanni venum', acceptable_answers: ['enakku thanni venum'] },
      'enakku thanni venum',
    )

    expect(graded?.verdict).toEqual({ kind: 'exact', matched: 'enakku thanni venum' })
  })

  it('marks a mismatch on a two-word answer wrong', () => {
    const graded = gradeTranslation('tamil', { direction: 'to_target', correct_answer: 'thanni venum' }, 'paal venum')

    expect(graded).toEqual({
      verdict: { kind: 'wrong', expected: 'thanni venum', firstDifference: { position: 1, expected: 'thanni', got: 'paal' } },
      is_correct: false,
    })
  })

  it('leaves a mismatch on a sentence for the tutor, pointing at the first word that differs', () => {
    const graded = gradeTranslation(
      'tamil',
      { direction: 'to_target', correct_answer: 'enakku thanni venum' },
      'enakku thaani vendaam',
    )

    expect(graded).toEqual({
      verdict: {
        kind: 'unlisted',
        expected: 'enakku thanni venum',
        firstDifference: { position: 3, expected: 'venum', got: 'vendaam' },
      },
    })
  })
})

describe('gradeChoice', () => {
  it('reports the selected and the correct option', () => {
    const graded = gradeChoice({ options: ['Aaru', 'Ettu', 'Naalu'], correct_index: 1 }, 2)

    expect(graded).toEqual({ is_correct: false, selected: 'Naalu', correct: 'Ettu' })
  })
})

describe('gradeArrange', () => {
  const input = { correct_order: ['Enakku', 'thanni', 'venum'] }

  it('accepts the listed order', () => {
    expect(gradeArrange(input, ['Enakku', 'thanni', 'venum'])).toEqual({ arrangement: 'listed', is_correct: true })
  })

  it('leaves another order for the tutor', () => {
    expect(gradeArrange(input, ['thanni', 'Enakku', 'venum'])).toEqual({
      arrangement: 'other_order',
      firstDifference: { position: 1, expected: 'Enakku', got: 'thanni' },
    })
  })

  it('marks an arrangement with unused words wrong', () => {
    expect(gradeArrange(input, ['Enakku', 'venum'])).toEqual({
      arrangement: 'incomplete',
      is_correct: false,
      used: 2,
      total: 3,
    })
  })
})

describe('formatExerciseResult', () => {
  it('tells the tutor what a variant differed in', () => {
    const result = { answer: 'thaani', ...gradeFillBlank('tamil', { correct_answer: 'thanni' }, 'thaani') }

    expect(formatExerciseResult('show_fill_blank', result)).toBe(
      'User submitted: "thaani". Checked in code: correct, a spelling variant of "thanni". Differs in: vowel length, doubled letters.',
    )
  })

  it('says a translation into English was not checked', () => {
    expect(formatExerciseResult('show_translation', { answer: 'I need water' })).toBe(
      'User submitted: "I need water". Not checked in code; judge the meaning yourself.',
    )
  })

  it('falls back to the ui package for a skipped exercise', () => {
    expect(formatExerciseResult('show_fill_blank', { skipped: true })).toBeUndefined()
  })

  it('falls back to the ui package for tools it does not grade', () => {
    expect(formatExerciseResult('show_flashcard', { rating: 'good' })).toBeUndefined()
  })
})
