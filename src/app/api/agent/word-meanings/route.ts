import { completeSimple, getEnvApiKey } from '@earendil-works/pi-ai'
import { TUTOR_MODEL } from '@/lang-app/models'

export async function POST(request: Request) {
  const { languageName, words } = (await request.json()) as { languageName?: string; words?: unknown }
  const list = Array.isArray(words)
    ? words.filter((w): w is string => typeof w === 'string' && w.trim().length > 0).slice(0, 100)
    : []
  if (list.length === 0 || !languageName) return Response.json({ meanings: {} })

  const prompt = `You are an expert in ${languageName} as it is actually spoken. Give the English meaning of each ${languageName} word or short phrase below, exactly as written. Many are conjugated verb forms in casual romanisation: identify the verb stem, then the tense, person, number and gender the ending marks, and give the meaning of that exact form, e.g. "we came", "she is doing", "I am coming". Do not confuse similar stems (for example bar- come vs bare- write). If a form is genuinely ambiguous, give the most common reading.

Answer with a JSON object mapping each input string exactly as given to a short English meaning. No other text.

${list.map(w => JSON.stringify(w)).join('\n')}`

  const response = await completeSimple(
    TUTOR_MODEL,
    { messages: [{ role: 'user', content: prompt, timestamp: Date.now() }] },
    { maxTokens: 4000, apiKey: getEnvApiKey('anthropic') },
  )

  const text = response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  let meanings: Record<string, string> = {}
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
      meanings = Object.fromEntries(
        Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string'),
      )
    } catch {
      meanings = {}
    }
  }
  return Response.json({ meanings })
}
