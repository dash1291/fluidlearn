'use client'

import type { ExerciseComponentProps } from '@fluid/ui'
import { useParams } from 'next/navigation'
import { SUPPORTED_LANGUAGES } from '@/lang-app/config'
import { useState } from 'react'
import { Volume2 } from 'lucide-react'

interface VocabularyInput {
  words: Array<{ word: string; tts_text?: string; translation: string; pronunciation?: string; example?: string }>
}

export function VocabularyList({ input, submitted, onSubmit }: ExerciseComponentProps<VocabularyInput>) {
  const params = useParams()
  const [speakingWord, setSpeakingWord] = useState<string | null>(null)
  const currentLanguage = SUPPORTED_LANGUAGES.find(
    lang => lang.code === params.language
  )

  const speechCode = currentLanguage?.speechCode || 'en'
  return (
    <div className="exercise-card">
      <div className="exercise-card-header">
        <span className="exercise-label">Vocabulary</span>
      </div>
      <div className="vocab-grid">
        {input.words.map((word, i) => (
          <div key={i} className="vocab-item">
            <div className="vocab-word">{word.word}
              <button
                className={`ml-2 translate-y-[2px] text-gray-500 transition-all duration-200 ${
                  speakingWord === word.word
                    ? 'scale-125 animate-pulse text-gray-700'
                    : 'scale-100'
                }`}
                onClick={async () => {
                  try {
                    setSpeakingWord(word.word)

                    const response = await fetch(
                      `/api/agent/tts?text=${encodeURIComponent(word.tts_text || word.word)}&lang=${speechCode}`
                    )

                    const blob = await response.blob()

                    const audioUrl = URL.createObjectURL(blob)

                    const audio = new Audio(audioUrl)

                    audio.onended = () => {
                      setSpeakingWord(null)
                    }

                    await audio.play()
                  }

                  catch (err) {
                    console.error(err)
                    setSpeakingWord(null)
                  }
                }}
              >
                <Volume2 size={16} />
              </button>
            </div>
            {word.pronunciation && <div className="vocab-pronunciation">{word.pronunciation}</div>}
            <div className="vocab-translation">{word.translation}</div>
            {word.example && <div className="vocab-example">{word.example}</div>}
          </div>
        ))}
      </div>
      {!submitted
        ? <button className="btn-primary" onClick={() => onSubmit({ acknowledged: true })}>Got it</button>
        : <p className="submitted-label">Reviewed</p>
      }
    </div>
  )
}
