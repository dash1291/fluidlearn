const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const audio = formData.get('audio') as Blob
    const language = formData.get('language') as string | null

    if (!audio) {
      return Response.json(
        { error: 'No audio provided' },
        { status: 400 }
      )
    }

    // Groq Whisper takes the audio as a multipart file upload plus an
    // ISO-639-1 language hint, which steers transcription far more reliably
    // than letting Whisper auto-detect (which misreads short Kannada clips).
    const groqForm = new FormData()
    groqForm.append('file', audio, 'audio.webm')
    groqForm.append('model', 'whisper-large-v3')
    groqForm.append('response_format', 'json')
    if (language) {
      groqForm.append('language', language)
    }

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqForm,
      signal: AbortSignal.timeout(30_000),
    })

    const text = await response.text()

    if (!response.ok) {
      console.error('Groq STT failed:', response.status, text.slice(0, 500))

      return Response.json(
        { error: `Speech service unavailable (${response.status})` },
        { status: 502 }
      )
    }

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'

    if (timedOut) {
      console.warn('STT: Groq Whisper timed out')
    } else {
      console.error('STT error:', error)
    }

    return Response.json(
      {
        error: timedOut ? 'Speech service timed out' : String(error),
      },
      {
        status: timedOut ? 504 : 500,
      }
    )
  }
}
