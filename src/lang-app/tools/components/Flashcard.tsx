'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@fluid/ui'
import { Mic, Volume2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { SUPPORTED_LANGUAGES } from '@/lang-app/config'
import { transliterate } from 'transliteration'

interface FlashcardInput {
  front: string
  back: string
  pronunciation?: string
  context?: string
}

interface FlashcardResult {
  rating: 'again' | 'hard' | 'good' | 'easy'
}

const RATINGS: { label: string; value: FlashcardResult['rating']; className: string }[] = [
  { label: 'Again', value: 'again', className: 'btn-rating-again' },
  { label: 'Hard', value: 'hard', className: 'btn-rating-hard' },
  { label: 'Good', value: 'good', className: 'btn-rating-good' },
  { label: 'Easy', value: 'easy', className: 'btn-rating-easy' },
]

export function Flashcard({ input, submitted, onSubmit }: ExerciseComponentProps<FlashcardInput, FlashcardResult>) {
  const [flipped, setFlipped] = useState(false)
  const [chosen, setChosen] = useState<FlashcardResult['rating'] | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const params = useParams()

  const currentLanguage = SUPPORTED_LANGUAGES.find(
    lang => lang.code === params.language
  )

  const speechCode = currentLanguage?.speechCode || 'en'
  const speakWord = async () => {
    try {
      setSpeaking(true)

      const response = await fetch(
        `/api/agent/tts?text=${encodeURIComponent(input.front)}&lang=${speechCode}`
      )

      const blob = await response.blob()

      const audioUrl = URL.createObjectURL(blob)

      const audio = new Audio(audioUrl)

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
      setListening(true)
      setPracticeMode(true)

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
          const audioBlob = new Blob(chunks, {
            type: 'audio/webm',
          })

          const formData = new FormData()

          formData.append('audio', audioBlob)

          const response = await fetch('/api/agent/stt', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()
          console.log(data)

          const rawSpoken =
          data.text ||
          data.generated_text ||
          data[0]?.generated_text ||
          ''

        const spoken = transliterate(rawSpoken)
          .toLowerCase()
          .replace(/[^a-z]/g, '')

        setTranscript(spoken)

          const expected = (
            input.pronunciation || ''
          )
            .toLowerCase()
            .replace(/[^a-z]/g, '')
          const similarity =
            spoken === expected ||
            spoken.startsWith(expected.slice(0, 5)) ||
            expected.startsWith(spoken.slice(0, 5))
          const correct =
            spoken.length > 4 &&
            (
              spoken.includes(expected.slice(0, 6)) ||
              expected.includes(spoken.slice(0, 6))
            )

          setIsCorrect(correct)

          setFlipped(true)

          if (!correct) {
            setTimeout(() => {
              setTranscript('')
              setIsCorrect(null)
              setFlipped(false)
            }, 4000)
          }
        }

        catch (err) {
          console.error(err)
        }

        finally {
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
  const handleRate = (rating: FlashcardResult['rating']) => {
    setChosen(rating)
    setPracticeMode(false)
    onSubmit({ rating })
  }

  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Flashcard</span>
      </div>
      <div
        className={`flashcard-face ${flipped ? 'flashcard-flipped' : ''}`}
        onClick={() => !submitted && setFlipped(f => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && !submitted && setFlipped(f => !f)}
      >
        {!flipped ? (
          <div className="flex items-center justify-center gap-2">
            <p className="flashcard-word">{input.front}</p>

            <button
              className={`text-gray-500 ${
                speaking ? 'animate-pulse scale-125' : ''
              }`}
              onClick={e => {
                e.stopPropagation()
                speakWord()
              }}
            >
              <Volume2 size={18} />
            </button>

            <button
              className={`text-gray-500 ${
                listening ? 'animate-pulse text-red-500' : ''
              }`}
              onClick={e => {
                e.stopPropagation()
                startListening()
              }}
            >
              <Mic size={18} />
            </button><button
  className="text-sm px-2 py-1 border rounded"
  onClick={e => {
    e.stopPropagation()
    setFlipped(true)
  }}
>
  Flip
</button>
          </div>
        ) : (
          <div className="flashcard-back">
            <p className="flashcard-word">{input.back}</p>
            {input.pronunciation && <p className="flashcard-pronunciation">{input.pronunciation}</p>}
            {input.context && <p className="flashcard-context">{input.context}</p>}
            {transcript != null && (
              <>
                <div style={{ pointerEvents: 'none' }}>
                  <p className="flashcard-context">
                    You said: {transcript}
                  </p>
                </div>

                {isCorrect !== null && (
                  <p
                    style={{
                      color: isCorrect ? 'green' : 'red',
                      fontWeight: 600,
                      marginTop: '6px',
                    }}
                  >
                    {isCorrect
                      ? 'Correct pronunciation!'
                      : 'Try again'}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {flipped && (!submitted || practiceMode) && (
        <div className="rating-row">
          {RATINGS.map(r => (
            <button key={r.value} className={r.className} onClick={() => handleRate(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {submitted && chosen && <p className="submitted-label">Rated: {chosen}</p>}
    </div>
  )
}
