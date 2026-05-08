'use client'

import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const handleGoogleSignIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
  }

  return (
    <main className="home-container">
      <div className="home-header">
        <h1 className="home-title">Fluid</h1>
        <p className="home-subtitle">Sign in to start learning</p>
      </div>
      <button className="btn-primary" onClick={handleGoogleSignIn} style={{ maxWidth: 280, margin: '0 auto' }}>
        Sign in with Google
      </button>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
