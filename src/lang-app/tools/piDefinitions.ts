import { Type } from '@earendil-works/pi-ai'
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { getLanguage } from '@/lang-app/config'
import { designPlan, expandUnit } from '@/lang-app/plan/designer'
import { findUnit, nextUnitAfter } from '@/lang-app/plan/progress'
import type { UnitLocation } from '@/lang-app/plan/progress'
import type { LearnerBrief, LearningPlan, UnitDetail } from '@/lang-app/memory/types'

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsPhrase(text: string, phrase: string): boolean {
  const trimmed = phrase.trim()
  if (trimmed.length < 2) return false
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text)
}

function sortedLower(items: string[]): string[] {
  return items.map(w => w.trim().toLowerCase()).sort()
}

// Throwing returns the message to the agent as a tool error so it retries.
function validateMultipleChoice(p: { question: string; options: string[]; correct_index: number }) {
  if (!Number.isInteger(p.correct_index) || p.correct_index < 0 || p.correct_index >= p.options.length) {
    throw new Error(`correct_index ${p.correct_index} is out of range for ${p.options.length} options.`)
  }
  if (new Set(sortedLower(p.options)).size !== p.options.length) {
    throw new Error('Options must be distinct. Rewrite the question with four different options.')
  }
  const leaked = p.options.find(o => containsPhrase(p.question, o))
  if (leaked) {
    throw new Error(
      `The option "${leaked}" appears in the question text, so the question gives away or contradicts its own answer. Ask in one direction only: either show the target-language word and offer English meanings, or show the English (or a number, picture description, etc.) and offer target-language words.`,
    )
  }
}

function validateFillBlank(p: { sentence_template: string; correct_answer: string }) {
  if (!p.sentence_template.includes('___')) {
    throw new Error('sentence_template must contain ___ where the blank goes.')
  }
  if (containsPhrase(p.sentence_template, p.correct_answer)) {
    throw new Error(`The answer "${p.correct_answer}" already appears in the sentence. Remove it so the blank is the only place it occurs.`)
  }
}

function validateArrange(p: { words: string[]; correct_order: string[] }) {
  const a = sortedLower(p.words)
  const b = sortedLower(p.correct_order)
  if (a.length !== b.length || a.some((w, i) => w !== b[i])) {
    throw new Error('words and correct_order must contain exactly the same tokens. Fix the mismatch and call again.')
  }
}

// Mirrors what the client will do with the same arguments, so the unit that
// gets prepared here is the one the learner lands on.
function unitAfterCompletion(
  plan: LearningPlan,
  p: { completedUnitId?: string; completedMilestoneId?: string },
): UnitLocation | null {
  if (p.completedMilestoneId) {
    const index = plan.milestones.findIndex(m => m.id === p.completedMilestoneId)
    if (index === -1) return null
    for (const milestone of plan.milestones.slice(index + 1)) {
      const unit = milestone.units?.find(u => u.status !== 'completed')
      if (unit) return { milestone, unit }
    }
    return null
  }
  const unitId = p.completedUnitId ?? plan.currentUnitId
  return unitId && findUnit(plan, unitId) ? nextUnitAfter(plan, unitId) : null
}

export interface LanguageToolContext {
  language?: string
  memoryContext?: string | null
  plan?: LearningPlan | null
}

export function createLanguageTools(send: SendFn, ctx: LanguageToolContext = {}): AgentTool<any>[] {
  const { language, memoryContext, plan } = ctx
  const languageName = (language && getLanguage(language)?.name) || language || 'the target language'
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
        'Show a multiple choice question. Good for grammar checks and comprehension questions. All options must be the same kind of thing the question asks for (all target-language words, or all English meanings, or all numbers), and the correct answer must not appear in the question text.',
      parameters: Type.Object({
        question: Type.String(),
        options: Type.Array(Type.String(), { minItems: 2, maxItems: 4 }),
        correct_index: Type.Integer({ description: 'Zero-based index of the correct option' }),
        explanation: Type.Optional(
          Type.String({ description: 'Brief explanation shown after answering' }),
        ),
      }),
      execute: async (toolCallId, params) => {
        validateMultipleChoice(params as { question: string; options: string[]; correct_index: number })
        return waitForUser(toolCallId, 'show_multiple_choice', params, send)
      },
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
      execute: async (toolCallId, params) => {
        validateFillBlank(params as { sentence_template: string; correct_answer: string })
        return waitForUser(toolCallId, 'show_fill_blank', params, send)
      },
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
      execute: async (toolCallId, params) => {
        validateArrange(params as { words: string[]; correct_order: string[] })
        return waitForUser(toolCallId, 'show_arrange', params, send)
      },
    },
    {
      name: 'set_learning_plan',
      label: 'Set Learning Plan',
      description:
        "Commission the learner's long-term roadmap. Call this once, after learning their goal and level, and only when no roadmap exists in the Returning Learner Context. A specialist curriculum designer turns your inputs into a full unit-by-unit plan, which takes a few minutes; the plan then appears in your context from the next turn on.",
      parameters: Type.Object({
        goal: Type.String({
          description: "The learner's high-level goal in plain language, e.g. \"hold a basic conversation with my in-laws\".",
        }),
        isDefault: Type.Boolean({
          description:
            'true if you adopted a standard general-proficiency goal because the learner gave none; false if the goal is theirs.',
        }),
        level: Type.String({
          description: "The learner's self-assessed starting level in a few words, e.g. \"complete beginner\", \"understands some spoken Tamil but cannot speak\".",
        }),
        timeAvailable: Type.Optional(
          Type.String({ description: 'Only if the learner stated one, e.g. "6 weeks, 20 minutes a day". Omit otherwise.' }),
        ),
        register: Type.Optional(
          Type.String({ description: 'Only if the learner stated one: spoken/colloquial, formal/written, or both. Omit otherwise.' }),
        ),
        prioritySituations: Type.Optional(
          Type.Array(Type.String(), {
            description: 'Situations the learner wants to handle, in their order of priority, only if they gave them.',
          }),
        ),
        exclusions: Type.Optional(
          Type.Array(Type.String(), { description: 'Things the learner explicitly does not need, e.g. "reading the script".' }),
        ),
        notes: Type.Optional(
          Type.String({
            description:
              'Everything else the designer should know: script or romanisation preference, who they will speak with, interests, prior languages.',
          }),
        ),
      }),
      execute: async (toolCallId, params) => {
        const p = params as { goal: string; isDefault: boolean; level: string } & LearnerBrief
        const designed = await designPlan({
          language: language ?? 'unknown',
          languageName,
          goal: p.goal,
          isDefault: p.isDefault,
          level: p.level,
          brief: {
            ...(p.timeAvailable ? { timeAvailable: p.timeAvailable } : {}),
            ...(p.register ? { register: p.register } : {}),
            ...(p.prioritySituations?.length ? { prioritySituations: p.prioritySituations } : {}),
            ...(p.exclusions?.length ? { exclusions: p.exclusions } : {}),
            ...(p.notes ? { notes: p.notes } : {}),
          },
          learnerContext: memoryContext ?? null,
        })
        return waitForUser(toolCallId, 'set_learning_plan', designed, send)
      },
    },

    {
      name: 'update_learning_plan',
      label: 'Update Learning Plan',
      description:
        "Record progress on the roadmap. Call it when the learner has met the current unit's mastery criteria; by default this completes the current unit. Pass completedUnitId to complete a specific unit, or completedMilestoneId to complete a whole milestone. The next unit's vocabulary and exercises are prepared as part of this call, which can take a minute or two; tell the learner before calling.",
      parameters: Type.Object({
        completedUnitId: Type.Optional(
          Type.String({ description: 'The [id] of the unit to mark complete, as shown in the roadmap.' }),
        ),
        completedMilestoneId: Type.Optional(
          Type.String({ description: 'The [id] of the milestone to mark complete, as shown in the roadmap.' }),
        ),
      }),
      execute: async (toolCallId, params) => {
        const p = params as { completedUnitId?: string; completedMilestoneId?: string }
        const args: {
          completedUnitId?: string
          completedMilestoneId?: string
          nextUnitId?: string
          nextUnitDetail?: UnitDetail
        } = { ...p }

        // Without a structured plan (anonymous session or a legacy roadmap
        // without units) the client just advances whatever it has stored.
        const next = plan ? unitAfterCompletion(plan, p) : null
        if (next && !next.unit.detail) {
          args.nextUnitId = next.unit.id
          args.nextUnitDetail = await expandUnit(
            {
              language: language ?? 'unknown',
              languageName,
              goal: plan!.goal,
              isDefault: plan!.isDefault,
              level: plan!.level ?? 'unknown',
              brief: plan!.brief ?? {},
              learnerContext: memoryContext ?? null,
            },
            plan!,
            next.unit.id,
          )
        }
        return waitForUser(toolCallId, 'update_learning_plan', args, send)
      },
    },
  ]
}
