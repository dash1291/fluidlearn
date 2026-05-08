import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fluid — Language Learning',
  description: 'Learn a new language with an adaptive AI tutor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
