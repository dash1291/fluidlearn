import { completeSimple, getEnvApiKey, Type } from '@earendil-works/pi-ai'
import type { AssistantMessage, Tool } from '@earendil-works/pi-ai'
import { DESIGNER_MODEL } from '@/lang-app/models'
import type {
  DesignedPlan,
  DesignedUnit,
  DialogueLine,
  GrammarPattern,
  LearnerBrief,
  LearningPlan,
  Phrase,
  UnitDetail,
} from '@/lang-app/memory/types'

export interface LearnerProfile {
  language: string
  languageName: string
  goal: string
  isDefault: boolean
  level: string
  brief: LearnerBrief
  learnerContext?: string | null
}

const EXERCISE_TYPES =
  'lesson card (short explanation with example phrases), vocabulary list, flashcard (listening / production / reading), pronunciation drill (learner speaks, speech-to-text is judged), multiple choice, fill in the blank, translation (either direction), sentence arrange (word order)'

const PHRASE_SCHEMA = Type.Object({
  native: Type.String({ description: 'Native script.' }),
  romanized: Type.String({ description: 'Simple, consistent romanisation used throughout the plan.' }),
  english: Type.String(),
  note: Type.Optional(Type.String({ description: 'One short clause: register, usage, or pronunciation.' })),
})

const SUBMIT_PLAN: Tool = {
  name: 'submit_plan',
  description: 'Submit the finished roadmap.',
  parameters: Type.Object({
    pronunciationRules: Type.Array(Type.String(), {
      description: 'At most five rules, only for sounds that cause misunderstanding. Each with an example word.',
      maxItems: 5,
    }),
    cultureNotes: Type.Array(Type.String(), {
      description: 'Etiquette specific to the goal: what to say and not say, how to address people, questions locals will ask.',
      maxItems: 8,
    }),
    milestones: Type.Array(
      Type.Object({
        id: Type.String({ description: 'Stable short id: m1, m2, ...' }),
        title: Type.String(),
        description: Type.String({
          description: 'One or two sentences: what the learner can do once this milestone is complete.',
        }),
        units: Type.Array(
          Type.Object({
            id: Type.String({ description: 'Stable short id scoped to the milestone: m1u1, m1u2, ...' }),
            title: Type.String(),
            objectives: Type.Array(Type.String(), {
              description: 'Two to four observable "can do" statements for this unit.',
              minItems: 1,
              maxItems: 4,
            }),
            masteryCriteria: Type.Array(Type.String(), {
              description: 'What the learner must demonstrate before the unit counts as complete.',
              minItems: 1,
              maxItems: 4,
            }),
            buildsOn: Type.Optional(
              Type.Array(Type.String(), {
                description: 'Ids of earlier units whose rules this unit depends on.',
              }),
            ),
          }),
          { minItems: 1, maxItems: 6 },
        ),
      }),
      { minItems: 2, maxItems: 8 },
    ),
  }),
}

const SUBMIT_UNIT: Tool = {
  name: 'submit_unit',
  description: 'Submit the finished unit.',
  parameters: Type.Object({
    goalPhrases: Type.Array(PHRASE_SCHEMA, {
      description: 'Four to six things the learner must be able to say by the end of the unit.',
      minItems: 3,
      maxItems: 6,
    }),
    grammar: Type.Array(
      Type.Object({
        pattern: Type.String({ description: 'The form, e.g. "noun + -ku".' }),
        meaning: Type.String({ description: 'What it does, in one sentence.' }),
        examples: Type.Array(PHRASE_SCHEMA, {
          description: 'Five to eight examples, several of them not among the goal phrases, so the rule is seen generating new sentences.',
          minItems: 3,
          maxItems: 8,
        }),
        trap: Type.Optional(Type.String({ description: 'The common confusion, e.g. two suffixes that look alike.' })),
        buildsOn: Type.Optional(Type.String({ description: 'Earlier rule this depends on, named by unit, e.g. "the -ku suffix from m2u1".' })),
      }),
      { description: 'The rules the goal phrases run on. Empty if the unit is purely lexical.', maxItems: 4 },
    ),
    vocabulary: Type.Array(PHRASE_SCHEMA, {
      description: 'Words needed for the goal phrases and the production tasks that are not already covered by them.',
      maxItems: 12,
    }),
    productionTasks: Type.Array(Type.String(), {
      description: 'Five English prompts for sentences that appear in no table, producible with this and earlier units\' rules and vocabulary.',
      minItems: 3,
      maxItems: 5,
    }),
    dialogue: Type.Array(
      Type.Object({
        speaker: Type.String(),
        native: Type.String(),
        romanized: Type.String(),
        english: Type.String(),
      }),
      { description: 'A short exchange, four to eight lines, the learner can role-play from either side.', maxItems: 8 },
    ),
    exerciseProgression: Type.Array(Type.String(), {
      description: 'Ordered steps for the tutor, naming exercise types from the available set.',
      minItems: 3,
      maxItems: 8,
    }),
    pitfalls: Type.Array(Type.String(), {
      description: 'Errors English speakers typically make with this material, and how to head them off.',
      maxItems: 5,
    }),
    uncertainties: Type.Array(Type.String(), {
      description: 'Regional variation or anything you are not confident about, with how the learner can check it with a native speaker.',
      maxItems: 3,
    }),
  }),
}

function profileText(p: LearnerProfile): string {
  const b = p.brief
  const parts = [
    `Language: ${p.languageName}`,
    `Goal: ${p.goal}${p.isDefault ? ' (learner gave no specific goal; this is a general-proficiency default)' : ''}`,
    `Self-assessed level: ${p.level}`,
    `Time available: ${b.timeAvailable ?? 'not stated; pace by mastery with no fixed end and size the roadmap to the goal'}`,
    `Register needed: ${b.register ?? 'not stated; choose what the goal implies and say so in the first milestone description'}`,
    `Priority situations, in the learner's order: ${
      b.prioritySituations?.length ? b.prioritySituations.join('; ') : 'not stated; infer them from the goal'
    }`,
    `Explicitly not needed: ${b.exclusions?.length ? b.exclusions.join('; ') : 'nothing stated'}`,
  ]
  if (b.notes) parts.push(`Notes from the tutor's conversation with the learner:\n${b.notes}`)
  if (p.learnerContext) parts.push(`Learner history and preferences:\n${p.learnerContext}`)
  return parts.join('\n')
}

function designerRole(languageName: string): string {
  return `You are a curriculum designer for ${languageName}, writing for an AI tutor that teaches English speakers through short interactive exercises. You are an expert in ${languageName} as it is actually spoken and in second-language acquisition.`
}

const PLAN_PRINCIPLES = `Principles:
- Phrases set the direction; rules are what the learner learns. Every unit exists to make the learner able to say specific things in a situation that matters to them, and to understand the rules those phrases run on well enough to make new sentences.
- Order units by the learner's priority situations when given, otherwise by usefulness for the goal. Earlier units teach the rules later units depend on; record those dependencies in buildsOn.
- Size the roadmap to the time available when stated. A unit is one to three sessions of about fifteen minutes.
- Pronunciation is five rules or fewer, stated once at plan level and taught briefly inside the first unit. Do not make a unit about the sound system.
- Objectives and mastery criteria are observable behaviours, stated briefly. Phrases, rules, and exercises are designed later, unit by unit, so do not include them here.
- Milestones group units into outcomes the learner would notice in real life.`

const UNIT_PRINCIPLES = `Principles:
- Goal phrases come first: what the learner must be able to say by the end. Then the rules those phrases run on, each as a pattern with several examples and its common trap, with examples that go beyond the goal phrases so the rule is seen generating new sentences. Prefer rules that generate many sentences over rules that explain one phrase.
- Use the forms people actually use in the register the learner needs. If spoken and written forms differ for something taught here, teach the requested one and mention the other in a note.
- Production tasks must not be answerable by recalling a table; they should require combining this unit's rules with earlier material.
- Keep notes to one short clause each. The tutor expands on them in conversation.
- Every phrase carries native script, the plan's romanisation, and English. The romanisation is a reading aid, kept consistent across units.
- Flag regional variation or low confidence once, in uncertainties, rather than hedging inside the material.

Available exercise types for the progression: ${EXERCISE_TYPES}.`

// Streams of several minutes occasionally drop mid-way; one retry covers that.
async function callDesigner(
  systemPrompt: string,
  userPrompt: string,
  tool: Tool,
  maxTokens: number,
): Promise<Record<string, unknown>> {
  try {
    return await callDesignerOnce(systemPrompt, userPrompt, tool, maxTokens)
  } catch (err) {
    console.warn('Curriculum design attempt failed, retrying once:', err instanceof Error ? err.message : err)
    return callDesignerOnce(systemPrompt, userPrompt, tool, maxTokens)
  }
}

async function callDesignerOnce(
  systemPrompt: string,
  userPrompt: string,
  tool: Tool,
  maxTokens: number,
): Promise<Record<string, unknown>> {
  const response: AssistantMessage = await completeSimple(
    DESIGNER_MODEL,
    {
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt, timestamp: Date.now() }],
      tools: [tool],
    },
    { maxTokens, apiKey: getEnvApiKey('anthropic') },
  )

  if (response.stopReason === 'error') {
    throw new Error(`Curriculum design failed: ${response.errorMessage ?? 'unknown error'}`)
  }
  if (response.stopReason === 'length') {
    throw new Error('Curriculum design failed: the designer ran out of room before finishing.')
  }

  const call = response.content.find(
    (c): c is Extract<typeof c, { type: 'toolCall' }> => c.type === 'toolCall' && c.name === tool.name,
  )
  if (!call) {
    throw new Error(`Curriculum design failed: the designer did not call ${tool.name}.`)
  }
  return call.arguments
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function phrases(value: unknown): Phrase[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (v): v is Phrase =>
        v && typeof v.native === 'string' && typeof v.romanized === 'string' && typeof v.english === 'string',
    )
    .map(v => ({ native: v.native, romanized: v.romanized, english: v.english, ...(v.note ? { note: v.note } : {}) }))
}

function toUnitDetail(args: Record<string, unknown>): UnitDetail {
  const goalPhrases = phrases(args.goalPhrases)
  if (goalPhrases.length === 0) {
    throw new Error('Curriculum design failed: the unit came back without goal phrases.')
  }
  const grammar: GrammarPattern[] = Array.isArray(args.grammar)
    ? args.grammar
        .filter((g): g is Record<string, unknown> => g && typeof g.pattern === 'string' && typeof g.meaning === 'string')
        .map(g => ({
          pattern: g.pattern as string,
          meaning: g.meaning as string,
          examples: phrases(g.examples),
          ...(typeof g.trap === 'string' ? { trap: g.trap } : {}),
          ...(typeof g.buildsOn === 'string' ? { buildsOn: g.buildsOn } : {}),
        }))
    : []
  const dialogue: DialogueLine[] = Array.isArray(args.dialogue)
    ? args.dialogue.filter(
        (d): d is DialogueLine =>
          d &&
          typeof d.speaker === 'string' &&
          typeof d.native === 'string' &&
          typeof d.romanized === 'string' &&
          typeof d.english === 'string',
      )
    : []
  return {
    goalPhrases,
    grammar,
    vocabulary: phrases(args.vocabulary),
    productionTasks: strings(args.productionTasks),
    dialogue,
    exerciseProgression: strings(args.exerciseProgression),
    pitfalls: strings(args.pitfalls),
    uncertainties: strings(args.uncertainties),
  }
}

export async function expandUnit(
  profile: LearnerProfile,
  plan: Pick<LearningPlan, 'milestones' | 'pronunciationRules'>,
  unitId: string,
): Promise<UnitDetail> {
  const milestone = plan.milestones.find(m => m.units?.some(u => u.id === unitId))
  const unit = milestone?.units?.find(u => u.id === unitId)
  if (!milestone || !unit) throw new Error(`Unit ${unitId} is not in the roadmap.`)

  const roadmap = plan.milestones
    .map(m => `[${m.id}] ${m.title}\n${(m.units ?? []).map(u => `  [${u.id}] ${u.title}`).join('\n')}`)
    .join('\n')
  const isFirst = plan.milestones[0]?.units?.[0]?.id === unitId

  const userPrompt = `${profileText(profile)}

Full roadmap, for context on what comes before and after:
${roadmap}
${plan.pronunciationRules?.length ? `\nPlan-level pronunciation rules (already fixed; ${isFirst ? 'teach them briefly in this first unit' : 'assume the learner has met them'}):\n${plan.pronunciationRules.map(r => `- ${r}`).join('\n')}\n` : ''}
Design unit [${unit.id}] "${unit.title}" in milestone [${milestone.id}] "${milestone.title}".
Objectives:
${unit.objectives.map(o => `- ${o}`).join('\n')}
Mastery criteria:
${unit.masteryCriteria.map(c => `- ${c}`).join('\n')}${
    unit.buildsOn?.length ? `\nBuilds on: ${unit.buildsOn.join(', ')}` : ''
  }

Call submit_unit once with the finished unit.`

  const args = await callDesigner(
    `${designerRole(profile.languageName)}

Design one unit of an existing roadmap so the tutor can teach it without further research.

${UNIT_PRINCIPLES}`,
    userPrompt,
    SUBMIT_UNIT,
    12_000,
  )
  return toUnitDetail(args)
}

function toSkeleton(args: Record<string, unknown>): DesignedPlan['milestones'] {
  const ms = Array.isArray(args.milestones) ? args.milestones : []
  const milestones = ms
    .filter(m => m && typeof m.id === 'string' && typeof m.title === 'string' && Array.isArray(m.units))
    .map(m => ({
      id: m.id as string,
      title: m.title as string,
      description: typeof m.description === 'string' ? m.description : '',
      units: (m.units as unknown[])
        .filter(
          (u): u is { id: string; title: string; objectives?: unknown; masteryCriteria?: unknown; buildsOn?: unknown } =>
            !!u && typeof (u as { id?: unknown }).id === 'string' && typeof (u as { title?: unknown }).title === 'string',
        )
        .map<DesignedUnit>(u => ({
          id: u.id,
          title: u.title,
          objectives: strings(u.objectives),
          masteryCriteria: strings(u.masteryCriteria),
          ...(strings(u.buildsOn).length ? { buildsOn: strings(u.buildsOn) } : {}),
        })),
    }))
    .filter(m => m.units.length > 0)
  if (milestones.length === 0) {
    throw new Error('Curriculum design failed: the roadmap came back empty.')
  }
  return milestones
}

// Designs the roadmap skeleton, then fills in the first unit so the tutor can
// start teaching as soon as the learner accepts the plan.
export async function designPlan(profile: LearnerProfile): Promise<DesignedPlan> {
  const args = await callDesigner(
    `${designerRole(profile.languageName)}

Design a complete, personalised roadmap for one learner: milestones, each broken into units, with objectives and mastery criteria for every unit. The tutor follows it unit by unit and advances only when the mastery criteria are met.

${PLAN_PRINCIPLES}

When the design is complete, call submit_plan exactly once with the full roadmap.`,
    profileText(profile),
    SUBMIT_PLAN,
    16_000,
  )
  const milestones = toSkeleton(args)
  const pronunciationRules = strings(args.pronunciationRules).slice(0, 5)
  const cultureNotes = strings(args.cultureNotes)

  const first = milestones[0].units[0]
  first.detail = await expandUnit(
    profile,
    {
      pronunciationRules,
      milestones: milestones.map(m => ({
        ...m,
        status: 'pending' as const,
        units: m.units.map(u => ({ ...u, status: 'pending' as const })),
      })),
    },
    first.id,
  )

  return {
    goal: profile.goal,
    isDefault: profile.isDefault,
    level: profile.level,
    brief: profile.brief,
    pronunciationRules,
    cultureNotes,
    milestones,
    designedBy: DESIGNER_MODEL.id,
  }
}
