import { resolvePending } from '@/framework/server/pendingToolResults'

export async function POST(request: Request) {
  const { toolCallId, result } = await request.json()

  const resolved = resolvePending(toolCallId, result)
  if (!resolved) {
    return Response.json({ error: 'Unknown tool call' }, { status: 404 })
  }

  return Response.json({ ok: true })
}
