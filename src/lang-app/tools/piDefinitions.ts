import { Type } from '@earendil-works/pi-ai'
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { registerPending } from '@/framework/server/pendingToolResults'

type SendFn = (event: object) => void

function displayed<T>(toolCallId: string, toolName: string, args: T, send: SendFn): AgentToolResult<T> {
  send({ type: 'tool_call', toolCallId, toolName, args })
  return { content: [{ type: 'text', text: 'Displayed to user.' }], details: args }
}

async function waitForUser<T>(toolCallId: string, toolName: string, args: T, send: SendFn): Promise<AgentToolResult<unknown>> {
  send({ type: 'tool_call', toolCallId, toolName, args })
  const result = await registerPending(toolCallId)
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    details: result,
  }
}

export function createLanguageTools(send: SendFn): AgentTool<any>[] {
  return [
    {
      name: 'show_lesson',
      label: 'Lesson',
      description:
        'Display a lesson card with explanatory text, grammar rules, or cultural notes. Use when introducing a new concept before practice exercises.',
      parameters: Type.Object({
        title: Type.String(),
        content: Type.String({
          description: 'Lesson content (plain text). Keep it concise — 3 to 5 key points max.',
        }),
        examples: Type.Optional(
          Type.Array(
            Type.Object({
              native: Type.String(),
              translation: Type.String(),
            }),
          ),
        ),
      }),
      execute: async (toolCallId, params) => displayed(toolCallId, 'show_lesson', params, send),
    },

    {
      name: 'show_vocabulary',
      label: 'Vocabulary',
      description:
        'Display a vocabulary list for the user to review. Use before drilling new words — introduce 3 to 8 words at a time.',
      parameters: Type.Object({
        words: Type.Array(
          Type.Object({
            word: Type.String({ description: 'Word in the target language, using the learner\'s preferred script/romanization if expressed.' }),
            translation: Type.String({ description: 'English translation' }),
            pronunciation: Type.Optional(
              Type.String({ description: 'Pronunciation guide or romanization' }),
            ),
            example: Type.Optional(
              Type.String({ description: 'Example sentence in the target language' }),
            ),
          }),
          { minItems: 2, maxItems: 10 },
        ),
      }),
      execute: async (toolCallId, params) => displayed(toolCallId, 'show_vocabulary', params, send),
    },

    {
      name: 'show_flashcard',
      label: 'Flashcard',
      description:
        'Show a single flashcard for vocabulary recall. The user flips it and rates how well they knew the answer.',
      parameters: Type.Object({
        front: Type.String({ description: 'Front of card — word or phrase in the target language. Use the learner\'s preferred script/romanization if they have expressed one.' }),
        back: Type.String({ description: 'Back of card — English translation' }),
        pronunciation: Type.Optional(
          Type.String({ description: 'Pronunciation guide or romanization' }),
        ),
        context: Type.Optional(
          Type.String({ description: 'Optional example sentence using the word' }),
        ),
      }),
      execute: async (toolCallId, params) => waitForUser(toolCallId, 'show_flashcard', params, send),
    },

    {
      name: 'show_multiple_choice',
      label: 'Multiple Choice',
      description:
        'Show a multiple choice question. Good for grammar checks and comprehension questions.',
      parameters: Type.Object({
        question: Type.String(),
        options: Type.Array(Type.String(), { minItems: 2, maxItems: 4 }),
        correct_index: Type.Number({ description: 'Zero-based index of the correct option' }),
        explanation: Type.Optional(
          Type.String({ description: 'Brief explanation shown after answering' }),
        ),
      }),
      execute: async (toolCallId, params) =>
        waitForUser(toolCallId, 'show_multiple_choice', params, send),
    },

    {
      name: 'show_fill_blank',
      label: 'Fill in the Blank',
      description:
        'Show a sentence with one blank the user must fill in. Use ___ to mark the blank. Good for grammar in context.',
      parameters: Type.Object({
        sentence_template: Type.String({
          description: 'Sentence with ___ for the blank. Use the learner\'s preferred script/romanization if they have expressed one.',
        }),
        correct_answer: Type.String({ description: 'The correct word or phrase for the blank, in the learner\'s preferred script/romanization.' }),
        hint: Type.Optional(Type.String({ description: 'Optional hint shown below the sentence' })),
        translation: Type.Optional(
          Type.String({ description: 'English translation of the complete sentence' }),
        ),
      }),
      execute: async (toolCallId, params) =>
        waitForUser(toolCallId, 'show_fill_blank', params, send),
    },

    {
      name: 'show_translation',
      label: 'Translation',
      description:
        'Ask the user to translate a phrase. Use for production practice after the user has seen the vocabulary.',
      parameters: Type.Object({
        prompt: Type.String({ description: 'The phrase or sentence to translate' }),
        direction: Type.Union([Type.Literal('to_target'), Type.Literal('to_native')], {
          description:
            'to_target: user translates from English into the target language. to_native: user translates from target language into English.',
        }),
        correct_answer: Type.String({ description: 'The ideal correct translation' }),
        acceptable_answers: Type.Optional(
          Type.Array(Type.String(), { description: 'Other valid translations' }),
        ),
      }),
      execute: async (toolCallId, params) =>
        waitForUser(toolCallId, 'show_translation', params, send),
    },

    {
      name: 'show_arrange',
      label: 'Sentence Arrange',
      description:
        'Show scrambled words for the user to arrange into a correct sentence. Good for word order and sentence construction.',
      parameters: Type.Object({
        words: Type.Array(Type.String(), {
          description:
            'Words presented in scrambled order. Each entry is one token (word or punctuated word like "Hola,").',
        }),
        correct_order: Type.Array(Type.String(), {
          description:
            'The exact same tokens as words, in the correct order. Every token in correct_order must appear in words and vice versa.',
        }),
        translation: Type.Optional(
          Type.String({ description: 'English translation of the complete sentence' }),
        ),
      }),
      execute: async (toolCallId, params) =>
        waitForUser(toolCallId, 'show_arrange', params, send),
    },
  ]
}
