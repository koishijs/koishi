import { Context, UserField, Meta, NextFunction } from 'koishi-core'
import { CQCode, simplify, noop, isInteger } from 'koishi-utils'
import { getDialogues, TeachConfig } from './utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'
import escapeRegex from 'escape-string-regexp'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/state' (state: SessionState): void
    'dialogue/receive' (state: SessionState): void | boolean
    'dialogue/before-attach-user' (state: SessionState, userFields: Set<UserField>): void
    'dialogue/attach-user' (state: SessionState): void | boolean
    'dialogue/before-send' (state: SessionState): any
    'dialogue/send' (state: SessionState): void
  }

  interface Context {
    getSessionState (this: Context, meta: Meta<'message'>): SessionState
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $_redirected?: number
  }
}

declare module './utils' {
  interface TeachConfig {
    charDelay?: number
    textDelay?: number
    nickname?: string | string[]
    appellationTimeout?: number
    maxRedirections?: number
    _stripQuestion? (source: string): [string, boolean, boolean]
  }
}

export interface SessionState {
  userId: number
  groupId: number
  answer?: string
  meta?: Meta<'message'>
  test?: DialogueTest
  dialogue?: Dialogue
  dialogues?: Dialogue[]
  next?: NextFunction
  isSearch?: boolean
}

const states: Record<number, SessionState> = {}

export function escapeAnswer (message: string) {
  return message.replace(/\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
}

export function unescapeAnswer (message: string) {
  return message.trim().replace(/@@__DOLLARS_PLACEHOLDER__@@/g, '$')
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
  const userFields = new Set<UserField>(['name'])
  ctx.app.emit(meta, 'dialogue/before-attach-user', state, userFields)
  if (dialogues.every(d => !d._weight)) return 0
  meta.$user = await ctx.database.observeUser(meta.$user, Array.from(userFields))
  if (ctx.app.bail(meta, 'dialogue/attach-user', state)) return 0
  return dialogues.reduce((prev, curr) => prev + curr._weight, 0)
}

export async function triggerDialogue (ctx: Context, meta: Meta<'message'>, config: TeachConfig, next: NextFunction = noop) {
  const state = ctx.getSessionState(meta)
  state.next = next
  state.test = {}

  if (ctx.bail('dialogue/receive', state)) return next()

  // fetch matched dialogues
  const dialogues = await getDialogues(ctx, state.test)
  state.dialogues = dialogues

  // pick dialogue
  let dialogue: Dialogue
  const total = await getTotalWeight(ctx, state)
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

  // parse answer
  state.dialogue = dialogue
  state.answer = dialogue.answer
    .replace(/\$\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
    .replace(/\$A/g, CQCode.stringify('at', { qq: 'all' }))
    .replace(/\$a/g, CQCode.stringify('at', { qq: meta.userId }))
    .replace(/\$m/g, CQCode.stringify('at', { qq: meta.selfId }))
    .replace(/\$s/g, escapeAnswer(meta.$nickname))
    .replace(/\$0/g, escapeAnswer(meta.message))

  if (dialogue.flag & DialogueFlag.regexp) {
    const capture = new RegExp(dialogue.question).exec(state.test.question) || [] as string[]
    capture.map((segment, index) => {
      if (index && index <= 9) {
        state.answer = state.answer.replace(new RegExp(`\\$${index}`, 'g'), segment)
      }
    })
  }

  const result = ctx.app.bail(meta, 'dialogue/before-send', state)
  if (result) return result

  // send answers
  const { textDelay = 1000, charDelay = 200 } = config
  ctx.logger('dialogue').debug(meta.message, '->', dialogue.answer)

  Object.defineProperty(meta, '$_redirected', {
    writable: true,
    value: (meta.$_redirected || 0) + 1,
  })

  let buffer = ''
  let index: number
  while ((index = state.answer.indexOf('$')) >= 0) {
    const char = state.answer[index + 1]
    if (!'n{'.includes(char)) {
      buffer += unescapeAnswer(state.answer.slice(0, index + 2))
      continue
    }
    buffer += unescapeAnswer(state.answer.slice(0, index))
    state.answer = state.answer.slice(index + 2)
    if (char === 'n') {
      await meta.$sendQueued(buffer, Math.max(buffer.length * charDelay, textDelay))
      buffer = ''
    } else {
      let end = state.answer.indexOf('}')
      if (end < 0) end = Infinity
      const command = unescapeAnswer(state.answer.slice(0, end))
      state.answer = state.answer.slice(end + 1)
      let useOriginal = false
      const send = meta.$send
      const sendQueued = meta.$sendQueued
      meta.$send = async (message: string) => {
        if (useOriginal) return send(message)
        buffer += message
      }
      meta.$sendQueued = async (message, ms) => {
        if (useOriginal) return sendQueued(message, ms)
        if (!message) return
        useOriginal = true
        await sendQueued(buffer + message, ms)
        buffer = ''
        useOriginal = false
      }
      await ctx.app.executeCommandLine(command, meta)
      useOriginal = true
    }
  }
  buffer += unescapeAnswer(state.answer)
  await meta.$sendQueued(buffer, 0)

  await ctx.app.parallelize(meta, 'dialogue/send', state)
}

export default function (ctx: Context, config: TeachConfig) {
  const { nickname = ctx.app.options.nickname, maxRedirections = 3 } = config
  const nicknames = Array.isArray(nickname) ? nickname : nickname ? [nickname] : []
  nicknames.push(`[cq:at,qq=${ctx.app.selfId}]`)
  const nicknameRE = new RegExp(`^((${nicknames.map(escapeRegex).join('|')})[,，]?\\s*)+`)

  config._stripQuestion = (source) => {
    source = simplify(stripPunctuation(String(source || '')))
    const original = source
    const capture = nicknameRE.exec(source)
    if (capture) source = source.slice(capture[0].length)
    return [
      source || original,
      source && source !== original,
      !source && source !== original,
    ]
  }

  ctx.intersect(ctx.app.groups).middleware(async (meta, next) => {
    return triggerDialogue(ctx, meta, config, next)
  })

  ctx.command('teach/dialogue <message...>', '触发教学对话')
    .option('-g, --group [id]', '设置要触发问答的群号')
    .action(async ({ meta, options, next }, message = '') => {
      if (meta.$_redirected > maxRedirections) return next()

      if (options.group !== undefined) {
        if (!isInteger(options.group) || options.group <= 0) {
          return meta.$send('选项 -g, --group 应为正整数。')
        }
        meta.groupId = options.group
      }

      if (meta.messageType !== 'group' && !options.group) {
        return meta.$send('请输入要触发问答的群号。')
      }

      meta.message = message
      return triggerDialogue(ctx, meta, config, next)
    })
}

const prefixPunctuation = /^([()\]]|\[(?!cq:))*/
const suffixPunctuation = /([.,?!()[~]|(?<!\[cq:[^\]]+)\])*$/

function stripPunctuation (source: string) {
  source = source.toLowerCase()
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
  return source
    .replace(prefixPunctuation, '')
    .replace(suffixPunctuation, '') || source
}
