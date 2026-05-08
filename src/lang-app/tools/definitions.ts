import { tool } from 'ai'
import { z } from 'zod'

export const languageTools = {
  show_lesson: tool({
    description:
      'Display a lesson card with explanatory text, grammar rules, or cultural notes. Use when introducing a new concept before practice exercises.',
    parameters: z.object({
      title: z.string(),
      content: z
        .string()
        .describe('Lesson content (plain text). Keep it concise — 3 to 5 key points max.'),
      examples: z
        .array(
          z.object({
            native: z.string(),
            translation: z.string(),
          }),
        )
        .optional()
        .describe('Example sentences in the target language with English translations'),
    }),
  }),

  show_vocabulary: tool({
    description:
      'Display a vocabulary list for the user to review. Use before drilling new words — introduce 3 to 8 words at a time.',
    parameters: z.object({
      words: z
        .array(
          z.object({
            word: z.string().describe('Word in the target language'),
            translation: z.string().describe('English translation'),
            pronunciation: z.string().optional().describe('Pronunciation guide or romanization'),
            example: z.string().optional().describe('Example sentence in the target language'),
          }),
        )
        .min(2)
        .max(10),
    }),
  }),

  show_flashcard: tool({
    description:
      'Show a single flashcard for vocabulary recall. The user flips it and rates how well they knew the answer.',
    parameters: z.object({
      front: z.string().describe('Front of card — word or phrase in the target language'),
      back: z.string().describe('Back of card — English translation'),
      pronunciation: z.string().optional().describe('Pronunciation guide or romanization'),
      context: z.string().optional().describe('Optional example sentence using the word'),
    }),
  }),

  show_multiple_choice: tool({
    description:
      'Show a multiple choice question. Good for grammar checks and comprehension questions.',
    parameters: z.object({
      question: z.string(),
      options: z.array(z.string()).min(2).max(4),
      correct_index: z.number().describe('Zero-based index of the correct option'),
      explanation: z.string().optional().describe('Brief explanation shown after answering'),
    }),
  }),

  show_fill_blank: tool({
    description:
      'Show a sentence with one blank the user must fill in. Use ___ to mark the blank. Good for grammar in context.',
    parameters: z.object({
      sentence_template: z
        .string()
        .describe('Sentence with ___ for the blank. Example: "Yo ___ agua."'),
      correct_answer: z.string().describe('The correct word or phrase for the blank'),
      hint: z.string().optional().describe('Optional hint shown below the sentence'),
      translation: z.string().optional().describe('English translation of the complete sentence'),
    }),
  }),

  show_translation: tool({
    description:
      'Ask the user to translate a phrase. Use for production practice after the user has seen the vocabulary.',
    parameters: z.object({
      prompt: z.string().describe('The phrase or sentence to translate'),
      direction: z
        .enum(['to_target', 'to_native'])
        .describe(
          'to_target: user translates from English into the target language. to_native: user translates from target language into English.',
        ),
      correct_answer: z.string().describe('The ideal correct translation'),
      acceptable_answers: z
        .array(z.string())
        .optional()
        .describe('Other valid translations'),
    }),
  }),

  show_arrange: tool({
    description:
      'Show scrambled words for the user to arrange into a correct sentence. Good for word order and sentence construction.',
    parameters: z.object({
      words: z.array(z.string()).describe('Words presented in scrambled order. Each entry is one token (word or punctuated word like "Hola,").'),
      correct_order: z.array(z.string()).describe('The exact same tokens as words, in the correct order. Every token in correct_order must appear in words and vice versa.'),
      translation: z
        .string()
        .optional()
        .describe('English translation of the complete sentence'),
    }),
  }),
}
