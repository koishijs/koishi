import { Context, UserField, getSenderName, Meta } from 'koishi-core'
import { CQCode, sleep } from 'koishi-utils'
import { simplifyQuestion, TeachConfig, LoopConfig } from './utils'
import { Dialogue } from './database'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-attach-user' (meta: Meta<'message'>, userFields: Set<UserField>): any
    'dialogue/attach-user' (meta: Meta<'message'>): any
    'dialogue/before-send' (meta: Meta<'message'>): any
    'dialogue/after-send' (meta: Meta<'message'>): any
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $dialogues?: Dialogue[]
  }
}

interface State {
  initiators: number[]
  counters: Record<number, number>
  predecessors: Record<number, number>
}

const states: Record<number, State> = {}

function escapeAnswer (message: string) {
  return message.replace(/\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
}

function unescapeAnswer (message: string) {
  return message.trim().replace(/@@__DOLLARS_PLACEHOLDER__@@/g, '$')
}

export default function (ctx: Context, config: TeachConfig) {
  const logger = ctx.logger('teach')

  const {
    throttle,
    preventLoop,
    successorTimeout = 20000,
  } = config

  const throttleConfig = !throttle ? []
    : Array.isArray(throttle) ? throttle
    : [throttle]
  const counters: Record<number, number> = {}
  for (const { interval, responses } of throttleConfig) {
    counters[interval] = responses
  }

  const preventLoopConfig: LoopConfig[] = !preventLoop ? []
    : typeof preventLoop === 'number' ? [{ length: preventLoop, participants: 1 }]
    : Array.isArray(preventLoop) ? preventLoop
    : [preventLoop]
  const initiatorCount = Math.max(0, ...preventLoopConfig.map(c => c.length))

  ctx.intersect(ctx.app.groups).middleware(async (meta, next) => {
    const { groupId } = meta
    const question = simplifyQuestion(meta.message)
    if (!question || question.includes('[cq:image,')) {
      return next()
    }

    const state = states[groupId] || (states[groupId] = {
      counters: { ...counters },
      initiators: [],
      predecessors: {},
    })

    // throttle
    for (const interval in state.counters) {
      if (state.counters[interval] <= 0) return next()
    }

    // prevent loop
    for (const { participants, length } of preventLoopConfig) {
      if (state.initiators.length < length) break
      const initiators = new Set(state.initiators.slice(0, length))
      if (initiators.size <= participants && initiators.has(meta.userId)) return next()
    }

    // fetch dialogues
    meta.$dialogues = await ctx.database.getSessionDialogues({
      question,
      partial: true,
      reversed: false,
      groups: ['' + groupId],
    }, Object.keys(state.predecessors))
    if (!meta.$dialogues.length) return next()

    // fetch user
    const userFields = new Set<UserField>(['name'])
    ctx.app.parallelize(meta, 'dialogue/before-attach-user', meta, userFields)
    meta.$user = await ctx.database.observeUser(meta.$user, Array.from(userFields))
    if (await ctx.app.serialize(meta, 'dialogue/attach-user', meta)) return next()

    // pick dialogue
    let dialogue: Dialogue
    const total = meta.$dialogues.reduce((prev, curr) => prev + curr.probability, 0)
    const target = Math.random() * Math.max(1, total)
    let pointer = 0
    for (const _dialogue of meta.$dialogues) {
      pointer += _dialogue.probability
      if (target < pointer) {
        dialogue = _dialogue
        break
      }
    }
    if (!dialogue) return next()

    logger.debug(question, '->', dialogue.answer)
    await ctx.app.parallelize(meta, 'dialogue/before-send', meta)

    // update throttle counter
    for (const { interval } of throttleConfig) {
      state.counters[interval]--
      setTimeout(() => state.counters[interval]++, interval)
    }

    // update initiators
    state.initiators.unshift(meta.userId)
    state.initiators.splice(initiatorCount, Infinity)

    // send answers
    const answers = dialogue.answer
      .replace(/\$\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
      .replace(/\$A/g, CQCode.stringify('at', { qq: 'all' }))
      .replace(/\$a/g, CQCode.stringify('at', { qq: meta.userId }))
      .replace(/\$m/g, CQCode.stringify('at', { qq: meta.selfId }))
      .replace(/\$s/g, escapeAnswer(getSenderName(meta)))
      .replace(/\$0/g, escapeAnswer(meta.message))
      .split('$n')
      .map(unescapeAnswer)

    for (const answer of answers) {
      await sleep(answer.length * 50)
      await meta.$send(answer)
    }

    await ctx.app.parallelize(meta, 'dialogue/after-send', meta)

    // update successors
    if (!dialogue.successors.length) return

    const time = Date.now()
    for (const id of dialogue.successors) {
      state.predecessors[id] = time
    }

    setTimeout(() => {
      const { predecessors } = states[meta.groupId]
      for (const id of dialogue.successors) {
        if (predecessors[id] === time) {
          delete predecessors[id]
        }
      }
    }, successorTimeout)
  })
}
