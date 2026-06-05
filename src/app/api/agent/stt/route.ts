export async function POST(req: Request) {
  try {

    const formData = await req.formData()

    const audio = formData.get('audio') as Blob

    console.log(audio)

    if (!audio) {
      return Response.json(
        { error: 'No audio provided' },
        { status: 400 }
      )
    }
    
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': audio.type,
        },
        body: audio,
      }
    )

    console.log('HF response status:', response.status)

    const text = await response.text()

    console.log(text)

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  catch (error) {
    console.error('FULL ERROR:', error)

    return Response.json(
      {
        error: String(error),
      },
      {
        status: 500,
      }
    )
  }
}