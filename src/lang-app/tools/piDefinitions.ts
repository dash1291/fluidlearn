import { Type } from '@earendil-works/pi-ai'
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'

type SendFn = (event: object) => void

function displayed<T>(toolCallId: string, toolName: string, args: T, send: SendFn): AgentToolResult<T> {
  send({ type: 'tool_call', toolCallId, toolName, args })
  return { content: [{ type: 'text', text: 'Displayed to user.' }], details: args }
}

function waitForUser<T>(toolCallId: string, toolName: string, args: T, send: SendFn): AgentToolResult<unknown> {
  send({ type: 'tool_call', toolCallId, toolName, args })
  // Return immediately and signal Pi to stop — client will submit the real result in the next request
  return {
    content: [{ type: 'text', text: 'Awaiting user input.' }],
    details: { __awaiting: toolCallId },
    terminate: true,
  }
}

const NATIVE_SCRIPT: Record<string, RegExp> = {
  kannada: /[ಀ-೿]/,
  hindi: /[ऀ-ॿ]/,
  tamil: /[஀-௿]/,
  japanese: /[぀-ヿ一-鿿]/,
  mandarin: /[一-鿿]/,
}

// TTS reads tts_text (falling back to the displayed word) and cannot pronounce
// romanized text, so whatever feeds the audio must contain native script.
// Throwing returns the message to the agent as a tool error so it retries.
function requireNativeTtsText(
  language: string | undefined,
  entries: { display: string; tts?: string }[],
) {
  const script = language ? NATIVE_SCRIPT[language] : undefined
  if (!script) return
  for (const { display, tts } of entries) {
    if (!script.test(tts || display)) {
      throw new Error(
        `"${display}" cannot be spoken aloud: no native-script text for TTS. Keep the displayed word as is, but also pass tts_text with the ${language} native-script form.`,
      )
    }
  }
}

export function createLanguageTools(send: SendFn, language?: string): AgentTool<any>[] {
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
            word: Type.String({ description: 'Word in the target language, in the learner\'s preferred script/romanization.' }),
            tts_text: Type.Optional(
              Type.String({ description: 'The word in the language\'s native script — used only for text-to-speech audio. Required whenever word is romanized; TTS cannot pronounce romanized text.' }),
            ),
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
      execute: async (toolCallId, params) => {
        const p = params as { words: { word: string; tts_text?: string }[] }
        requireNativeTtsText(language, p.words.map(w => ({ display: w.word, tts: w.tts_text })))
        return displayed(toolCallId, 'show_vocabulary', params, send)
      },
    },

    {
      name: 'show_flashcard',
      label: 'Flashcard',
      description:
        'Show a single flashcard for vocabulary recall. The user flips it and rates how well they knew the answer. The mode controls which direction is quizzed.',
      parameters: Type.Object({
        front: Type.String({ description: 'The word or phrase in the target language, in the learner\'s preferred script/romanization. Always the target-language side, regardless of mode.' }),
        tts_text: Type.Optional(
          Type.String({ description: 'The word in the language\'s native script — used only for text-to-speech audio. Required whenever front is romanized; TTS cannot pronounce romanized text.' }),
        ),
        back: Type.String({ description: 'English translation' }),
        mode: Type.Union(
          [Type.Literal('listening'), Type.Literal('production'), Type.Literal('reading')],
          {
            description:
              'Quiz direction. listening: the user hears the word spoken aloud and recalls its meaning — the default for oral-first beginners. production: the user sees the English and recalls the target word — use for active recall once a word has been introduced. reading: the user reads the target-language text and recalls the meaning — only when the learner is practicing reading the script.',
          },
        ),
        pronunciation: Type.Optional(
          Type.String({ description: 'Pronunciation guide or romanization' }),
        ),
        context: Type.Optional(
          Type.String({ description: 'Optional example sentence using the word' }),
        ),
      }),
      execute: async (toolCallId, params) => {
        const p = params as { front: string; tts_text?: string }
        requireNativeTtsText(language, [{ display: p.front, tts: p.tts_text }])
        return waitForUser(toolCallId, 'show_flashcard', params, send)
      },
    },

    {
      name: 'show_pronunciation_drill',
      label: 'Pronunciation Drill',
      description:
        'Ask the user to say a word or short phrase aloud. Their speech is transcribed and returned as the result — judge whether it matches the target and give brief feedback. Use after introducing a word, especially for beginners.',
      parameters: Type.Object({
        word: Type.String({ description: 'Word or short phrase to pronounce, in the learner\'s preferred script/romanization.' }),
        tts_text: Type.Optional(
          Type.String({ description: 'The word in the language\'s native script — used only for text-to-speech audio. Required whenever word is romanized; TTS cannot pronounce romanized text.' }),
        ),
        pronunciation: Type.Optional(
          Type.String({ description: 'Pronunciation guide or romanization shown to the user' }),
        ),
        translation: Type.Optional(
          Type.String({ description: 'English translation shown to the user' }),
        ),
      }),
      execute: async (toolCallId, params) => {
        const p = params as { word: string; tts_text?: string }
        requireNativeTtsText(language, [{ display: p.word, tts: p.tts_text }])
        return waitForUser(toolCallId, 'show_pronunciation_drill', params, send)
      },
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
