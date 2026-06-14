'use client'

import { useState } from 'react'
import type { ExerciseComponentProps } from '@fluid/ui'
import { Volume2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { SUPPORTED_LANGUAGES } from '@/lang-app/config'

type FlashcardMode = 'listening' | 'production' | 'reading'

interface FlashcardInput {
  front: string
  tts_text?: string
  back: string
  mode?: FlashcardMode
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
  const params = useParams()

  // Cards from before the mode param existed have no mode — they were text-front
  const mode: FlashcardMode = input.mode ?? 'reading'

  const currentLanguage = SUPPORTED_LANGUAGES.find(
    lang => lang.code === params.language
  )

  const speechCode = currentLanguage?.speechCode || 'en'
  const speakWord = async () => {
    try {
      setSpeaking(true)

      const response = await fetch(
        `/api/agent/tts?text=${encodeURIComponent(input.tts_text || input.front)}&lang=${speechCode}`
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
  const handleRate = (rating: FlashcardResult['rating']) => {
    setChosen(rating)
    onSubmit({ rating })
  }

  const speakButton = (size: number) => (
    <button
      className={`text-gray-500 ${
        speaking ? 'animate-pulse scale-125' : ''
      }`}
      onClick={e => {
        e.stopPropagation()
        speakWord()
      }}
    >
      <Volume2 size={size} />
    </button>
  )

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
          <div className="flex flex-col items-center justify-center gap-2">
            {mode === 'listening' && (
              <>
                {speakButton(32)}
                <p className="flashcard-context">Tap the card to reveal.</p>
              </>
            )}
            {mode === 'production' && (
              <>
                <p className="flashcard-word">{input.back}</p>
                <p className="flashcard-context">
                  Say it in {currentLanguage?.name ?? 'the target language'}
                </p>
              </>
            )}
            {mode === 'reading' && (
              <div className="flex items-center justify-center gap-2">
                <p className="flashcard-word">{input.front}</p>
                {speakButton(18)}
              </div>
            )}
          </div>
        ) : (
          <div className="flashcard-back">
            {mode === 'reading' ? (
              <p className="flashcard-word">{input.back}</p>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2">
                  <p className="flashcard-word">{input.front}</p>
                  {speakButton(18)}
                </div>
                <p className="flashcard-context">{input.back}</p>
              </>
            )}
            {input.pronunciation && <p className="flashcard-pronunciation">{input.pronunciation}</p>}
            {input.context && <p className="flashcard-context">{input.context}</p>}
          </div>
        )}
      </div>
      {flipped && !submitted && (
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
