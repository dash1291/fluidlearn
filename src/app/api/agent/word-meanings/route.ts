import { completeSimple, getEnvApiKey } from '@earendil-works/pi-ai'
import { UTILITY_MODEL } from '@/lang-app/models'

export async function POST(request: Request) {
  const { languageName, words } = (await request.json()) as { languageName?: string; words?: unknown }
  const list = Array.isArray(words)
    ? words.filter((w): w is string => typeof w === 'string' && w.trim().length > 0).slice(0, 100)
    : []
  if (list.length === 0 || !languageName) return Response.json({ meanings: {} })

  const prompt = `Give the English meaning of each ${languageName} word or short phrase below. They may be in native script or romanised. Answer with a JSON object mapping each input string exactly as given to a short English meaning (a few words). No other text.

${list.map(w => JSON.stringify(w)).join('\n')}`

  const response = await completeSimple(
    UTILITY_MODEL,
    { messages: [{ role: 'user', content: prompt, timestamp: Date.now() }] },
    { maxTokens: 2000, apiKey: getEnvApiKey('anthropic') },
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
