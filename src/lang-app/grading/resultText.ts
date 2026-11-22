import type { ArrangeGraded, ChoiceGraded, Verdict, WordDifference } from './grade'

function difference(d: WordDifference | undefined): string {
  if (!d) return ''
  const expected = d.expected === null ? 'nothing' : `"${d.expected}"`
  const got = d.got === null ? 'nothing' : `"${d.got}"`
  return ` First difference at word ${d.position}: expected ${expected}, got ${got}.`
}

function typedAnswer(answer: string, verdict: Verdict | undefined): string {
  const submitted = `User submitted: "${answer}".`
  if (!verdict) return `${submitted} Not checked in code; judge the meaning yourself.`
  switch (verdict.kind) {
    case 'exact':
      return `${submitted} Checked in code: correct, exact match.`
    case 'variant':
      return `${submitted} Checked in code: correct, a spelling variant of "${verdict.matched}". Differs in: ${verdict.differences.join(', ')}.`
    case 'wrong':
      return `${submitted} Checked in code: wrong, the answer is "${verdict.expected}".${difference(verdict.firstDifference)}`
    case 'unlisted':
      return `${submitted} Checked in code: not one of the listed answers ("${verdict.expected}").${difference(verdict.firstDifference)} Another wording can still be right; judge the meaning yourself.`
  }
}

function choice(r: Partial<ChoiceGraded>): string {
  return r.is_correct
    ? `User selected "${r.selected}". Checked in code: correct.`
    : `User selected "${r.selected}". Checked in code: wrong, the correct option is "${r.correct}".`
}

function arrange(order: string[], r: Partial<ArrangeGraded> & { firstDifference?: WordDifference; used?: number; total?: number }): string {
  const arranged = `User arranged: [${order.join(', ')}].`
  switch (r.arrangement) {
    case 'listed':
      return `${arranged} Checked in code: correct, the listed order.`
    case 'incomplete':
      return `${arranged} Checked in code: wrong, only ${r.used} of ${r.total} words were used.`
    default:
      return `${arranged} Checked in code: not the listed order.${difference(r.firstDifference)} Another order can still be grammatical; judge it yourself.`
  }
}

// The text the tutor reads as an exercise result. Returns undefined for tools
// and results this module does not grade, so the ui package's text is used.
export function formatExerciseResult(toolName: string, result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as Record<string, unknown>
  switch (toolName) {
    case 'show_fill_blank':
    case 'show_translation':
      return typeof r.answer === 'string' ? typedAnswer(r.answer, r.verdict as Verdict | undefined) : undefined
    case 'show_multiple_choice':
      return typeof r.selected === 'string' ? choice(r as Partial<ChoiceGraded>) : undefined
    case 'show_arrange':
      return Array.isArray(r.order) && typeof r.arrangement === 'string'
        ? arrange(r.order as string[], r as Partial<ArrangeGraded>)
        : undefined
    default:
      return undefined
  }
}
