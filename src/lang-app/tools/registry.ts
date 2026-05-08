import type { ComponentRegistry } from '@/framework/types'
import { LessonCard } from './components/LessonCard'
import { VocabularyList } from './components/VocabularyList'
import { Flashcard } from './components/Flashcard'
import { MultipleChoice } from './components/MultipleChoice'
import { FillBlank } from './components/FillBlank'
import { TranslationChallenge } from './components/TranslationChallenge'
import { SentenceArrange } from './components/SentenceArrange'

export const languageComponentRegistry: ComponentRegistry = {
  show_lesson: LessonCard,
  show_vocabulary: VocabularyList,
  show_flashcard: Flashcard,
  show_multiple_choice: MultipleChoice,
  show_fill_blank: FillBlank,
  show_translation: TranslationChallenge,
  show_arrange: SentenceArrange,
}
