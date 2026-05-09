import Link from 'next/link'
import { SUPPORTED_LANGUAGES } from '@/lang-app/config'
import { UserMenu } from '@/framework/ui/UserMenu'

export default function Home() {
  return (
    <main className="home-container">
      <UserMenu />
      <div className="home-header">
        <h1 className="home-title">Fluid</h1>
        <p className="home-subtitle">Learn a language with your AI tutor</p>
      </div>
      <div className="language-grid">
        {SUPPORTED_LANGUAGES.map(lang => (
          <Link key={lang.code} href={`/learn/${lang.code}`} className="language-card">
            <span className="language-flag">{lang.flag}</span>
            <span className="language-name">{lang.name}</span>
            <span className="language-native">{lang.nativeName}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
