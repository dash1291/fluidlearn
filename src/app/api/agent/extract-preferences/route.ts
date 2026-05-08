import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request: Request) {
  const { newMessages, existingPreferences, languageName } = await request.json()

  // Pull user text from the new turn only
  const userTexts: string[] = (newMessages as unknown[])
    .filter((m): m is { role: string; content: unknown } => typeof m === 'object' && m !== null && 'role' in m)
    .filter(m => m.role === 'user')
    .map(m => {
      const c = m.content
      if (typeof c === 'string') return c
      if (Array.isArray(c)) {
        return c
          .filter((b): b is { type: string; text: string } => b?.type === 'text')
          .map(b => b.text)
          .join('')
      }
      return ''
    })
    .filter(t => t && t !== '__lesson_start__')

  if (userTexts.length === 0) {
    return Response.json({ preferences: existingPreferences ?? null })
  }

  const existing = existingPreferences
    ? `Current preferences:\n${existingPreferences}\n\n`
    : ''

  const prompt = `${existing}New messages from the learner in a ${languageName} lesson:
${userTexts.map(t => `- "${t}"`).join('\n')}

Extract any lasting style preferences the learner expressed — things like script/transliteration choices, formality level, topic interests, pacing. Ignore temporary requests (skip this, go back, etc.).

Return a concise bullet list of ALL current preferences (merging old and new). If nothing changed and there are no current preferences, return an empty string.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  return Response.json({ preferences: text || null })
}
