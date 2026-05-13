import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { language, seconds }: { language?: string; seconds?: number } =
    await request.json()

  if (!language || typeof seconds !== 'number' || seconds <= 0) {
    return Response.json({ ok: false }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('language_time')
    .select('total_seconds')
    .eq('user_id', user.id)
    .eq('language', language)
    .maybeSingle()

  const newTotal = (existing?.total_seconds ?? 0) + Math.round(seconds)

  const { error } = await supabase.from('language_time').upsert(
    {
      user_id: user.id,
      language,
      total_seconds: newTotal,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,language' },
  )

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, total_seconds: newTotal })
}
