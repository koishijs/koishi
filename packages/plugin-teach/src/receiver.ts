import { Context, UserField, Meta, NextFunction, Command } from 'koishi-core'
import { CQCode, simplify, noop } from 'koishi-utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'
import escapeRegex from 'escape-string-regexp'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/state' (state: SessionState): void
    'dialogue/receive' (state: SessionState): void | boolean
    'dialogue/prepare' (state: SessionState): void
    'dialogue/before-attach-user' (state: SessionState, userFields: Set<UserField>): void
    'dialogue/attach-user' (state: SessionState): void | boolean
    'dialogue/before-send' (state: SessionState): void | boolean | Promise<void | boolean>
    'dialogue/send' (state: SessionState): void
  }

  interface Context {
    getSessionState (this: Context, meta: Meta): SessionState
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $_redirected?: number
  }
}

interface Question {
  /** 去除句首句尾标点符号，句中空格后的句子 */
  prefixed: string
  /** 去除句首句尾标点符号，句中空格和句首称呼的句子 */
  unprefixed: string
  /** 是否含有称呼 */
  appellative: boolean
  /** 是否仅含有称呼 */
  activated: boolean
}

declare module './database' {
  namespace Dialogue {
    interface Config {
      charDelay?: number
      textDelay?: number
      nickname?: string | string[]
      appellationTimeout?: number
      maxRedirections?: number
      _stripQuestion? (source: string): Question
    }
  }
}

export interface SessionState {
  userId: number
  groupId: number
  answer?: string
  meta?: Meta<UserField>
  test?: DialogueTest
  dialogue?: Dialogue
  dialogues?: Dialogue[]
  next?: NextFunction
  isSearch?: boolean
}

const states: Record<number, SessionState> = {}

export function escapeAnswer (message: string) {
  return message.replace(/%/g, '@@__PLACEHOLDER__@@')
}

export function unescapeAnswer (message: string) {
  return message.replace(/@@__PLACEHOLDER__@@/g, '%')
}

Context.prototype.getSessionState = function (meta) {
  const { groupId, anonymous, userId } = meta
  if (!states[groupId]) {
    this.emit('dialogue/state', states[groupId] = { groupId } as SessionState)
  }
  const state = Object.create(states[groupId])
  state.meta = meta
  state.userId = anonymous ? -anonymous.id : userId
  return state
}

export async function getTotalWeight (ctx: Context, state: SessionState) {
  const { meta, dialogues } = state
  ctx.app.emit(meta, 'dialogue/prepare', state)
  const userFields = new Set<UserField>(['name'])
  ctx.app.emit(meta, 'dialogue/before-attach-user', state, userFields)
  await meta.observeUser(userFields)
  if (ctx.app.bail(meta, 'dialogue/attach-user', state)) return 0
  return dialogues.reduce((prev, curr) => prev + curr._weight, 0)
}

export async function triggerDialogue (ctx: Context, meta: Meta, config: Dialogue.Config, next: NextFunction = noop) {
  const state = ctx.getSessionState(meta)
  state.next = next
  state.test = {}

  if (ctx.bail('dialogue/receive', state)) return next()
  const logger = ctx.logger('dialogue')
  logger.debug('[receive]', meta.messageId, meta.message)

  // fetch matched dialogues
  const dialogues = state.dialogues = await Dialogue.fromTest(ctx, state.test)

  // pick dialogue
  let dialogue: Dialogue
  const total = await getTotalWeight(ctx, state)
  if (!total) return next()
  const target = Math.random() * Math.max(1, total)
  let pointer = 0
  for (const _dialogue of dialogues) {
    pointer += _dialogue._weight
    if (target < pointer) {
      dialogue = _dialogue
      break
    }
  }
  if (!dialogue) return next()
  logger.debug('[attach]', meta.messageId)

  // parse answer
  state.dialogue = dialogue
  state.dialogues = [dialogue]
  state.answer = dialogue.answer
    .replace(/%%/g, '@@__PLACEHOLDER__@@')
    .replace(/%A/g, CQCode.stringify('at', { qq: 'all' }))
    .replace(/%a/g, CQCode.stringify('at', { qq: meta.userId }))
    .replace(/%m/g, CQCode.stringify('at', { qq: meta.selfId }))
    .replace(/%s/g, escapeAnswer(meta.$username))
    .replace(/%0/g, escapeAnswer(meta.message))

  if (dialogue.flag & DialogueFlag.regexp) {
    const capture = dialogue._capture || new RegExp(dialogue.question).exec(state.test.question)
    capture.map((segment, index) => {
      if (index && index <= 9) {
        state.answer = state.answer.replace(new RegExp(`%${index}`, 'g'), escapeAnswer(segment || ''))
      }
    })
  }

  if (await ctx.app.serialize(meta, 'dialogue/before-send', state)) return
  logger.debug('[send]', meta.messageId, '->', dialogue.answer)

  // send answers
  const { textDelay = 1000, charDelay = 200 } = config
  meta.$_redirected = (meta.$_redirected || 0) + 1

  // wrapper for meta.$send
  let buffer = ''
  let useOriginal = false
  const send = meta.$send.bind(meta)
  const sendQueued = meta.$sendQueued.bind(meta)

  meta.$send = async (message: string) => {
    if (useOriginal) return send(message)
    buffer += message
  }

  meta.$sendQueued = async (message, ms) => {
    if (useOriginal) return sendQueued(message, ms)
    if (!message) return
    return sendBuffered(buffer + message, ms)
  }

  async function sendBuffered (message: string, ms: number) {
    useOriginal = true
    await sendQueued(message.trim(), ms)
    buffer = ''
    useOriginal = false
  }

  // parse answer
  let index: number
  while ((index = state.answer.indexOf('%')) >= 0) {
    const char = state.answer[index + 1]
    if (!'n{'.includes(char)) {
      buffer += unescapeAnswer(state.answer.slice(0, index + 2))
      state.answer = state.answer.slice(index + 2)
      continue
    }
    buffer += unescapeAnswer(state.answer.slice(0, index))
    state.answer = state.answer.slice(index + 2)
    if (char === 'n') {
      await sendBuffered(buffer, Math.max(buffer.length * charDelay, textDelay))
    } else if (char === '{') {
      let end = state.answer.indexOf('}')
      if (end < 0) end = Infinity
      const command = unescapeAnswer(state.answer.slice(0, end))
      state.answer = state.answer.slice(end + 1)
      useOriginal = false
      const send = meta.$send
      const sendQueued = meta.$sendQueued
      await ctx.execute(command, meta)
      meta.$sendQueued = sendQueued
      meta.$send = send
      useOriginal = true
    }
  }
  await sendBuffered(buffer + unescapeAnswer(state.answer), 0)
  useOriginal = true

  await ctx.app.parallelize(meta, 'dialogue/send', state)
}

export default function (ctx: Context, config: Dialogue.Config) {
  const { nickname = ctx.app.options.nickname, maxRedirections = 3 } = config
  const nicknames = Array.isArray(nickname) ? nickname : nickname ? [nickname] : []
  const nicknameRE = new RegExp(`^((${nicknames.map(escapeRegex).join('|')})[,，]?\\s*)+`)

  config._stripQuestion = (source) => {
    source = prepareSource(source)
    const original = source
    const capture = nicknameRE.exec(source)
    if (capture) source = source.slice(capture[0].length)
    return {
      prefixed: original,
      unprefixed: source || original,
      appellative: source && source !== original,
      activated: !source && source !== original,
    }
  }

  ctx.intersect(ctx.app.groups).middleware(async (meta, next) => {
    return triggerDialogue(ctx, meta, config, next)
  })

  ctx.on('dialogue/receive', ({ meta, test }) => {
    if (meta.message.includes('[CQ:image,')) return true
    const { unprefixed, prefixed, appellative, activated } = config._stripQuestion(meta.message)
    test.question = unprefixed
    test.original = prefixed
    test.activated = activated
    test.appellative = appellative
  })

  // 预判要获取的用户字段
  ctx.on('dialogue/before-attach-user', ({ dialogues, meta }, userFields) => {
    for (const data of dialogues) {
      const capture = data.answer.match(/%\{.+?\}/g)
      for (const message of capture || []) {
        const argv = ctx.parse(message.slice(2, -1), meta)
        Command.collect(argv, 'user', userFields)
      }
      if (capture || data.answer.includes('%n')) {
        userFields.add('timers')
      }
    }
  })

  ctx.intersect(ctx.app.groups).command('teach/dialogue <message...>', '触发教学对话')
    .action(async ({ meta, next }, message = '') => {
      if (meta.$_redirected > maxRedirections) return next()
      meta.message = message
      return triggerDialogue(ctx, meta, config, next)
    })
}

function prepareSource (source: string) {
  return CQCode.stringifyAll(CQCode.parseAll(source || '').map((code, index, arr) => {
    if (typeof code !== 'string') return code
    let message = simplify(CQCode.unescape('' + code))
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/，/g, ',')
      .replace(/、/g, ',')
      .replace(/。/g, '.')
      .replace(/？/g, '?')
      .replace(/！/g, '!')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/【/g, '[')
      .replace(/】/g, ']')
      .replace(/～/g, '~')
      .replace(/…/g, '...')
    if (index === 0) message = message.replace(/^[()\[\]]*/, '')
    if (index === arr.length - 1) message = message.replace(/[\.,?!()\[\]~]*$/, '')
    return message
  }))
}
