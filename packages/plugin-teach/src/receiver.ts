import { Context, UserField, Meta, NextFunction } from 'koishi-core'
import { CQCode, sleep, simplify } from 'koishi-utils'
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
    nickname?: string | string[]
    appellationTimeout?: number
    maxRedirections?: number
    _stripQuestion? (source: string): [string, boolean, boolean]
  }
}

declare module './database' {
  interface DialogueTest {
    redirect?: boolean
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

export async function triggerDialogue (ctx: Context, meta: Meta<'message'>, next: NextFunction) {
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
  ctx.logger('dialogue').debug(meta.message, '->', dialogue.answer)
  const answers = state.answer.split('$n').map(unescapeAnswer)

  for (const answer of answers) {
    await sleep(answer.length * 50)
    await meta.$send(answer)
  }

  await ctx.app.parallelize(meta, 'dialogue/send', state)
}

export default function (ctx: Context, config: TeachConfig) {
  const { nickname = ctx.app.options.nickname } = config
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
    return triggerDialogue(ctx, meta, next)
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
