import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fluid — Language Learning',
    short_name: 'Fluid',
    description: 'Learn a new language with an adaptive AI tutor',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f8f7',
    theme_color: '#2563eb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
