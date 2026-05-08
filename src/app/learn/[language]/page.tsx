import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLanguage } from '@/lang-app/config'
import { createClient } from '@/lib/supabase/server'
import { LearnClient } from './LearnClient'
import type { LanguageMemoryData } from '@/lang-app/memory/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ language: string }>
}

export default async function LearnPage({ params }: Props) {
  const { language } = await params
  const lang = getLanguage(language)
  if (!lang) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialMessages: unknown[] = []
  let initialMemory: LanguageMemoryData | null = null

  if (user) {
    const [convResult, memResult] = await Promise.all([
      supabase
        .from('conversation_history')
        .select('messages')
        .eq('user_id', user.id)
        .eq('language', lang.code)
        .maybeSingle(),
      supabase
        .from('language_memory')
        .select('data')
        .eq('user_id', user.id)
        .eq('language', lang.code)
        .maybeSingle(),
    ])
    initialMessages = convResult.data?.messages ?? []
    initialMemory = memResult.data?.data ?? null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div className="learn-header">
        <Link href="/" className="back-link">Back</Link>
        <span className="learn-flag">{lang.flag}</span>
        <h1 className="learn-title">{lang.name}</h1>
      </div>
      <LearnClient
        language={lang.code}
        languageName={lang.name}
        initialMessages={initialMessages}
        initialMemory={initialMemory}
      />
    </div>
  )
}
