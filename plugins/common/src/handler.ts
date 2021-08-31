import { Context, Session, Random, Awaitable } from 'koishi'

declare module 'koishi' {
  interface EventMap {
    'repeater'(session: Session, state: RepeatState): void
  }
}

interface RepeatState {
  content: string
  repeated: boolean
  times: number
  users: Record<string, number>
}

type StateCallback = (state: RepeatState, session: Session) => void | string

interface RepeatHandler {
  minTimes: number
  probability?: number
}

function onRepeat(options: RepeatHandler | StateCallback): StateCallback {
  if (!options || typeof options !== 'object') return options as StateCallback
  const { minTimes, probability = 1 } = options
  return ({ repeated, times, content }) => times >= minTimes && !repeated && Random.bool(probability) ? content : ''
}

export interface RepeaterConfig {
  onRepeat?: RepeatHandler | StateCallback
  onInterrupt?: StateCallback
}

export function repeater(ctx: Context, config: RepeaterConfig = {}) {
  ctx = ctx.guild()

  const states: Record<string, RepeatState> = {}

  function getState(id: string) {
    return states[id] || (states[id] = {
      content: '',
      repeated: false,
      times: 0,
      users: {},
    })
  }

  ctx.before('send', ({ cid, content }) => {
    const state = getState(cid)
    state.repeated = true
    if (state.content === content) {
      state.times += 1
    } else {
      state.content = content
      state.times = 1
      state.users = {}
    }
  })

  ctx.middleware((session, next) => {
    const { content, uid, userId } = session

    // never respond to messages from self
    if (ctx.bots.get(uid)) return

    const state = getState(session.cid)
    const check = (handle: StateCallback) => {
      const text = handle?.(state, session)
      return text && next(() => {
        ctx.emit('repeater', session, state)
        return session.send(text)
      })
    }

    // duplicate repeating & normal repeating
    if (content === state.content) {
      state.times += 1
      state.users[userId] = (state.users[userId] || 0) + 1
      return check(onRepeat(config.onRepeat)) || next()
    }

    // interrupt repeating
    const result = check(config.onInterrupt)
    if (result) return result

    // unrepeated message
    state.content = content
    state.repeated = false
    state.times = 1
    state.users = { [userId]: 1 }
    return next()
  })
}

type RequestHandler = string | boolean | ((session: Session) => Awaitable<string | boolean | void>)
type Response = [boolean, string?]

async function useRequestHandler(handler: RequestHandler, session: Session, prefer: boolean): Promise<Response> {
  const result = typeof handler === 'function' ? await handler(session) : handler
  if (typeof result === 'string') {
    return [prefer, result]
  } else if (typeof result === 'boolean') {
    return [result]
  }
}

async function checkUserAuthority(session: Session, authority: number): Promise<Response> {
  const user = await session.observeUser(['authority'])
  if (user.authority >= authority) return [true]
}

async function checkChannelAuthority(session: Session, authority: number): Promise<Response> {
  const channel = await session.observeChannel(['assignee'])
  if (channel.assignee) return [true]
  const user = await session.observeUser(['authority'])
  if (user.authority >= authority) {
    channel.assignee = session.selfId
    await channel.$update()
    return [true]
  }
}

export interface VerifierConfig {
  onFriendRequest?: number | RequestHandler
  onGuildMemberRequest?: number | RequestHandler
  onGuildRequest?: number | RequestHandler
}

export function verifier(ctx: Context, config: VerifierConfig = {}) {
  const { onFriendRequest, onGuildRequest, onGuildMemberRequest } = config

  ctx.on('friend-request', async (session) => {
    const result = typeof onFriendRequest === 'number'
      ? await checkUserAuthority(session, onFriendRequest)
      : await useRequestHandler(onFriendRequest, session, true)
    if (result) return session.bot.handleFriendRequest(session.messageId, ...result)
  })

  ctx.on('guild-request', async (session) => {
    const result = typeof onGuildRequest === 'number'
      ? await checkChannelAuthority(session, onGuildRequest)
      : await useRequestHandler(onGuildRequest, session, false)
    if (result) return session.bot.handleGuildRequest(session.messageId, ...result)
  })

  ctx.on('guild-member-request', async (session) => {
    const result = typeof onGuildMemberRequest === 'number'
      ? await checkUserAuthority(session, onGuildMemberRequest)
      : await useRequestHandler(onGuildMemberRequest, session, false)
    if (result) return session.bot.handleGuildMemberRequest(session.messageId, ...result)
  })
}

export interface HandlerConfig extends RepeaterConfig, VerifierConfig {}

export default function apply(ctx: Context, config?: HandlerConfig) {
  ctx.plugin(repeater, config)
  ctx.plugin(verifier, config)
}
