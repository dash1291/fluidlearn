'use client'

import { useEffect, useState } from 'react'
import type { LanguageMemoryStore } from '@/lang-app/memory/store'

interface Props {
  store: LanguageMemoryStore
  languageName: string
}

export function VocabularyPanel({ store, languageName }: Props) {
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(0)
  const vocab = open ? store.getVocabulary() : null
  const total = vocab ? vocab.fromPlan.length + vocab.fromCards.length : 0

  // Words scored before their meaning was recorded get one looked up once.
  useEffect(() => {
    if (!open) return
    const missing = store
      .getVocabulary()
      .practised.filter(w => !w.meaning)
      .map(w => w.word)
    if (missing.length === 0) return
    fetch('/api/agent/word-meanings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageName, words: missing }),
    })
      .then(r => r.json())
      .then(({ meanings }) => {
        if (meanings && typeof meanings === 'object') {
          store.setWordMeanings(meanings as Record<string, string>)
          setVersion(v => v + 1)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button className="vocab-button" onClick={() => setOpen(true)}>
        Vocabulary
      </button>

      {open && vocab && (
        <div className="vocab-overlay" onClick={() => setOpen(false)}>
          <div className="vocab-panel" onClick={e => e.stopPropagation()}>
            <div className="vocab-panel-header">
              <h2 className="vocab-panel-title">
                {languageName} vocabulary
                <span className="vocab-count">{total} items</span>
              </h2>
              <button className="vocab-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            {total === 0 && vocab.practised.length === 0 && (
              <p className="vocab-empty">Nothing recorded yet. Words appear here as your tutor introduces them.</p>
            )}

            {vocab.fromPlan.length > 0 && (
              <section className="vocab-section">
                <h3>From your units</h3>
                <table className="vocab-table">
                  <tbody>
                    {vocab.fromPlan.map(p => (
                      <tr key={`${p.unitId}-${p.native}`}>
                        <td className="vocab-native">{p.native}</td>
                        <td className="vocab-roman">{p.romanized}</td>
                        <td>{p.english}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {vocab.fromCards.length > 0 && (
              <section className="vocab-section">
                <h3>Introduced in lessons</h3>
                <table className="vocab-table">
                  <tbody>
                    {vocab.fromCards.map(w => (
                      <tr key={w.word}>
                        <td className="vocab-native">{w.word}</td>
                        <td className="vocab-roman">{w.pronunciation ?? ''}</td>
                        <td>{w.translation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {vocab.practised.length > 0 && (
              <section className="vocab-section" key={version}>
                <h3>Practised in exercises</h3>
                <table className="vocab-table">
                  <tbody>
                    {vocab.practised.map(w => (
                      <tr key={w.word} className={w.incorrect > w.correct ? 'vocab-weak' : undefined}>
                        <td className="vocab-native">{w.word}</td>
                        <td>{w.meaning ?? ''}</td>
                        <td className="vocab-score">
                          {w.correct} right, {w.incorrect} wrong
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}
