import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLanguage } from '@/lang-app/config'
import { LearnClient } from './LearnClient'

interface Props {
  params: Promise<{ language: string }>
}

export default async function LearnPage({ params }: Props) {
  const { language } = await params
  const lang = getLanguage(language)
  if (!lang) notFound()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div className="learn-header">
        <Link href="/" className="back-link">Back</Link>
        <span className="learn-flag">{lang.flag}</span>
        <h1 className="learn-title">{lang.name}</h1>
      </div>
      <LearnClient language={lang.code} languageName={lang.name} />
    </div>
  )
}

export function generateStaticParams() {
  return [
    { language: 'spanish' },
    { language: 'french' },
    { language: 'japanese' },
    { language: 'german' },
    { language: 'portuguese' },
    { language: 'italian' },
    { language: 'mandarin' },
    { language: 'kannada' },
  ]
}
