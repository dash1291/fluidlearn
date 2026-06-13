'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@fluid/ui'
import { isSkipped } from '@fluid/ui'
import { Mic, Volume2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { SUPPORTED_LANGUAGES } from '@/lang-app/config'

interface PronunciationDrillInput {
  word: string
  tts_text?: string
  pronunciation?: string
  translation?: string
}

interface PronunciationDrillResult {
  spoken: string
}

export function PronunciationDrill({ input, submitted, result, onSubmit }: ExerciseComponentProps<PronunciationDrillInput, PronunciationDrillResult>) {
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const params = useParams()
  const skipped = isSkipped(result)

  const currentLanguage = SUPPORTED_LANGUAGES.find(
    lang => lang.code === params.language
  )

  const speechCode = currentLanguage?.speechCode || 'en'

  const speakWord = async () => {
    try {
      setSpeaking(true)

      const response = await fetch(
        `/api/agent/tts?text=${encodeURIComponent(input.tts_text || input.word)}&lang=${speechCode}`
      )

      const blob = await response.blob()

      const audio = new Audio(URL.createObjectURL(blob))

      audio.onended = () => {
        setSpeaking(false)
      }

      await audio.play()
    }

    catch (err) {
      console.error(err)
      setSpeaking(false)
    }
  }

  const startListening = async () => {
    try {
      setError('')
      setListening(true)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      const mediaRecorder = new MediaRecorder(stream)

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = event => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        setListening(false)
        try {
          if (chunks.length === 0) {
            return
          }

          setTranscribing(true)

          const audioBlob = new Blob(chunks, {
            type: 'audio/webm',
          })

          const formData = new FormData()

          formData.append('audio', audioBlob)
          formData.append('language', speechCode)

          const response = await fetch('/api/agent/stt', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json().catch(() => null)

          if (!response.ok || !data) {
            setError('Speech recognition is slow or down right now — try again.')
            return
          }

          const spoken = (
            data.text ||
            data.generated_text ||
            data[0]?.generated_text ||
            ''
          ).trim()

          if (!spoken) {
            setError("We couldn't hear you — try again.")
            return
          }

          onSubmit({ spoken })
        }

        catch (err) {
          console.error(err)
          setError('Something went wrong — try again.')
        }

        finally {
          setTranscribing(false)
          stream.getTracks().forEach(track => track.stop())
        }
      }

      mediaRecorder.start()

      setTimeout(() => {
        mediaRecorder.stop()
      }, 3000)
    }

    catch (err) {
      console.error(err)

      setListening(false)
    }
  }

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Pronunciation</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <p className="flashcard-word">{input.word}</p>

        <button
          className={`text-gray-500 ${
            speaking ? 'animate-pulse scale-125' : ''
          }`}
          onClick={speakWord}
        >
          <Volume2 size={18} />
        </button>
      </div>
      {input.pronunciation && <p className="flashcard-pronunciation">{input.pronunciation}</p>}
      {input.translation && <p className="flashcard-context">{input.translation}</p>}
      {!submitted ? (
        <>
          <button
            className="btn-primary"
            onClick={startListening}
            disabled={listening || transcribing}
          >
            <Mic size={16} className={`inline ${listening ? 'animate-pulse text-red-500' : ''}`} />{' '}
            {listening ? 'Listening...' : transcribing ? 'Transcribing...' : 'Say it'}
          </button>
          {error && <p className="flashcard-context">{error}</p>}
        </>
      ) : skipped ? (
        <div className="translation-result result-skipped">—</div>
      ) : (
        <div className="translation-result result-submitted">You said: {result?.spoken}</div>
      )}
    </div>
  )
}
