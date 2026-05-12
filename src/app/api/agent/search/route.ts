import { createClient } from '@/lib/supabase/server'

interface PiTextContent {
  type: 'text'
  text: string
}

function extractMessageText(msg: unknown): string {
  const m = msg as Record<string, unknown>
  if (m.role === 'user') {
    const content = m.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .filter((b): b is PiTextContent => (b as PiTextContent)?.type === 'text')
        .map(b => b.text)
        .join('')
    }
  }
  if (m.role === 'assistant') {
    const content = m.content
    if (Array.isArray(content)) {
      return content
        .filter((b): b is PiTextContent => (b as PiTextContent)?.type === 'text')
        .map(b => b.text)
        .join('')
    }
  }
  return ''
}

export async function POST(request: Request) {
  const { query, language }: { query?: string; language?: string } = await request.json()
  if (!query || query.trim().length < 2) {
    return Response.json({ results: [] })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ results: [] })
  }

  let dbQuery = supabase
    .from('conversation_history')
    .select('language, messages')
    .eq('user_id', user.id)

  if (language) {
    dbQuery = dbQuery.eq('language', language)
  }

  const { data, error } = await dbQuery

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{
    language: string
    messageIndex: number
    role: string
    text: string
    snippet: string
  }> = []

  const q = query.toLowerCase()

  for (const row of (data ?? [])) {
    const messages = (row.messages ?? []) as unknown[]
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const text = extractMessageText(msg)
      if (!text) continue
      const lower = text.toLowerCase()
      if (lower.includes(q)) {
        const idx = lower.indexOf(q)
        const start = Math.max(0, idx - 40)
        const end = Math.min(text.length, idx + q.length + 40)
        const snippet =
          (start > 0 ? '...' : '') +
          text.slice(start, end) +
          (end < text.length ? '...' : '')
        results.push({
          language: row.language,
          messageIndex: i,
          role: (msg as Record<string, unknown>).role as string,
          text,
          snippet,
        })
      }
    }
  }

  // Cap results to keep response small
  const limited = results.slice(0, 50)

  return Response.json({ results: limited })
}
