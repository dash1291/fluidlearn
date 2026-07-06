import type { ComponentRegistry } from '@fluid/ui'
import { LessonCard } from './components/LessonCard'
import { VocabularyList } from './components/VocabularyList'
import { Flashcard } from './components/Flashcard'
import { PronunciationDrill } from './components/PronunciationDrill'
import { MultipleChoice } from './components/MultipleChoice'
import { FillBlank } from './components/FillBlank'
import { TranslationChallenge } from './components/TranslationChallenge'
import { SentenceArrange } from './components/SentenceArrange'
import { LearningPlanCard } from './components/LearningPlanCard'

export const languageComponentRegistry: ComponentRegistry = {
  show_lesson: LessonCard,
  show_vocabulary: VocabularyList,
  show_flashcard: Flashcard,
  show_pronunciation_drill: PronunciationDrill,
  show_multiple_choice: MultipleChoice,
  show_fill_blank: FillBlank,
  show_translation: TranslationChallenge,
  show_arrange: SentenceArrange,
  set_learning_plan: LearningPlanCard,
  update_learning_plan: LearningPlanCard,
}
