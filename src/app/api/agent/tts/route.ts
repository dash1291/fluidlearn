import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams

    const text = searchParams.get('text')
    const lang = searchParams.get('lang')

    if (!text || !lang) {
      return new Response('Missing params', { status: 400 })
    }

    const url =
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!response.ok) {
      return new Response('Google TTS failed', { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })
  }

  catch (error) {
    console.error(error)

    return new Response('Server error', { status: 500 })
  }
}