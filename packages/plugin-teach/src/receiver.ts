import { Context, User, Session, NextFunction, Command } from 'koishi-core'
import { CQCode, simplify, noop } from 'koishi-utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'
import escapeRegex from 'escape-string-regexp'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/state' (state: SessionState): void
    'dialogue/receive' (state: SessionState): void | boolean
    'dialogue/prepare' (state: SessionState): void
    'dialogue/before-attach-user' (state: SessionState, userFields: Set<User.Field>): void
    'dialogue/attach-user' (state: SessionState): void | boolean
    'dialogue/before-send' (state: SessionState): void | boolean | Promise<void | boolean>
    'dialogue/send' (state: SessionState): void
  }

  interface Context {
    getSessionState (this: Context, session: Session): SessionState
  }
}

declare module 'koishi-core/dist/session' {
  interface Session {
    _redirected?: number
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
      nickname?: string | string[]
      appellationTimeout?: number
      maxRedirections?: number
      _stripQuestion? (source: string): Question
    }
  }
}

// TODO change name
export interface SessionState {
  userId: number
  groupId: number
  answer?: string
  session?: Session<User.Field>
  test?: DialogueTest
  dialogue?: Dialogue
  dialogues?: Dialogue[]
  next?: NextFunction
  isSearch?: boolean
}

const states: Record<number, SessionState> = {}

export function escapeAnswer(message: string) {
  return message.replace(/%/g, '@@__PLACEHOLDER__@@')
}

export function unescapeAnswer(message: string) {
  return message.replace(/@@__PLACEHOLDER__@@/g, '%')
}

Context.prototype.getSessionState = function (session) {
  const { groupId, anonymous, userId } = session
  if (!states[groupId]) {
    this.emit('dialogue/state', states[groupId] = { groupId } as SessionState)
  }
  const state = Object.create(states[groupId])
  state.session = session
  state.userId = anonymous ? -anonymous.id : userId
  return state
}

export async function getTotalWeight(ctx: Context, state: SessionState) {
  const { session, dialogues } = state
  ctx.app.emit(session, 'dialogue/prepare', state)
  const userFields = new Set<User.Field>(['name'])
  ctx.app.emit(session, 'dialogue/before-attach-user', state, userFields)
  await session.$observeUser(userFields)
  if (ctx.app.bail(session, 'dialogue/attach-user', state)) return 0
  return dialogues.reduce((prev, curr) => prev + curr._weight, 0)
}

export class MessageBuffer {
  private buffer = ''
  private original = false

  public hasData = false
  public send: Session['$send']
  public sendQueued: Session['$sendQueued']

  constructor(private session: Session) {
    this.send = session.$send.bind(session)
    this.sendQueued = session.$sendQueued.bind(session)

    session.$send = async (message: string) => {
      if (!message) return
      this.hasData = true
      if (this.original) {
        return this.send(message)
      }
      this.buffer += message
    }

    session.$sendQueued = async (message, delay) => {
      if (!message) return
      this.hasData = true
      if (this.original) {
        return this.sendQueued(message, delay)
      }
      return this._flush(this.buffer + message, delay)
    }
  }

  write(message: string) {
    if (!message) return
    this.hasData = true
    this.buffer += message
  }

  private async _flush(message: string, delay?: number) {
    this.original = true
    message = message.trim()
    await this.sendQueued(message, delay)
    this.buffer = ''
    this.original = false
  }

  flush() {
    return this._flush(this.buffer)
  }

  async run <T>(callback: () => T | Promise<T>) {
    this.original = false
    const send = this.session.$send
    const sendQueued = this.session.$sendQueued
    const result = await callback()
    this.session.$sendQueued = sendQueued
    this.session.$send = send
    this.original = true
    return result
  }

  async end(message = '') {
    this.write(message)
    await this.flush()
    this.original = true
    delete this.session.$send
    delete this.session.$sendQueued
  }
}

export async function triggerDialogue(ctx: Context, session: Session, config: Dialogue.Config, next: NextFunction = noop) {
  const state = ctx.getSessionState(session)
  state.next = next
  state.test = {}

  if (ctx.bail('dialogue/receive', state)) return next()
  const logger = ctx.logger('dialogue')
  logger.debug('[receive]', session.messageId, session.message)

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
  logger.debug('[attach]', session.messageId)

  // parse answer
  state.dialogue = dialogue
  state.dialogues = [dialogue]
  state.answer = dialogue.answer
    .replace(/%%/g, '@@__PLACEHOLDER__@@')
    .replace(/%A/g, CQCode.stringify('at', { qq: 'all' }))
    .replace(/%a/g, CQCode.stringify('at', { qq: session.userId }))
    .replace(/%m/g, CQCode.stringify('at', { qq: session.selfId }))
    .replace(/%s/g, escapeAnswer(session.$username))
    .replace(/%0/g, escapeAnswer(session.message))

  if (dialogue.flag & DialogueFlag.regexp) {
    const capture = dialogue._capture || new RegExp(dialogue.question, 'i').exec(state.test.question)
    if (!capture) console.log(dialogue.question, state.test.question)
    capture.map((segment, index) => {
      if (index && index <= 9) {
        state.answer = state.answer.replace(new RegExp(`%${index}`, 'g'), escapeAnswer(segment || ''))
      }
    })
  }

  if (await ctx.app.serial(session, 'dialogue/before-send', state)) return
  logger.debug('[send]', session.messageId, '->', dialogue.answer)

  // send answers
  const buffer = new MessageBuffer(session)
  session._redirected = (session._redirected || 0) + 1

  // parse answer
  let index: number
  while ((index = state.answer.indexOf('%')) >= 0) {
    const char = state.answer[index + 1]
    if (!'n{'.includes(char)) {
      buffer.write(unescapeAnswer(state.answer.slice(0, index + 2)))
      state.answer = state.answer.slice(index + 2)
      continue
    }
    buffer.write(unescapeAnswer(state.answer.slice(0, index)))
    state.answer = state.answer.slice(index + 2)
    if (char === 'n') {
      await buffer.flush()
    } else if (char === '{') {
      const argv = session.$parse(state.answer, '}')
      state.answer = argv.rest.slice(1)
      await buffer.run(() => session.$execute(argv))
    }
  }
  await buffer.end(unescapeAnswer(state.answer))
  await ctx.app.parallel(session, 'dialogue/send', state)
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

  ctx.group().middleware(async (session, next) => {
    return triggerDialogue(ctx, session, config, next)
  })

  ctx.on('dialogue/receive', ({ session, test }) => {
    if (session.message.includes('[CQ:image,')) return true
    const { unprefixed, prefixed, appellative, activated } = config._stripQuestion(session.message)
    test.question = unprefixed
    test.original = prefixed
    test.activated = activated
    test.appellative = appellative
  })

  // 预判要获取的用户字段
  ctx.on('dialogue/before-attach-user', ({ dialogues, session }, userFields) => {
    for (const data of dialogues) {
      const capture = data.answer.match(/%\{.+?\}/g)
      for (const message of capture || []) {
        const argv = session.$parse(message.slice(2, -1))
        Command.collect(argv, 'user', userFields)
      }
      if (capture || data.answer.includes('%n')) {
        userFields.add('timers')
      }
    }
  })

  ctx.group().command('teach/dialogue <message...>', '触发教学对话')
    .action(async ({ session, next }, message = '') => {
      if (session._redirected > maxRedirections) return next()
      session.message = message
      return triggerDialogue(ctx, session, config, next)
    })
}

function prepareSource(source: string) {
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
