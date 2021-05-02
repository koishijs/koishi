import { Context, Session, Random } from 'koishi-core'

declare module 'koishi-core' {
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

export function repeater(ctx: Context, config: HandlerConfig) {
  ctx = ctx.group()

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
    if (ctx.bots[uid]) return

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

type RequestHandler = string | boolean | ((session: Session) => string | boolean | void | Promise<string | boolean | void>)

async function getHandlerResult(handler: RequestHandler, session: Session, prefer: boolean): Promise<[boolean, string?]> {
  const result = typeof handler === 'function' ? await handler(session) : handler
  if (typeof result === 'string') {
    return [prefer, result]
  } else if (typeof result === 'boolean') {
    return [result]
  }
}

export function verify(ctx: Context, config: HandlerConfig) {
  ctx.on('friend-request', async (session) => {
    const result = await getHandlerResult(config.onFriendRequest, session, true)
    if (result) return session.bot.handleFriendRequest(session.messageId, ...result)
  })

  ctx.on('group-request', async (session) => {
    const result = await getHandlerResult(config.onGroupRequest, session, false)
    if (result) return session.bot.handleGroupRequest(session.messageId, ...result)
  })

  ctx.on('group-member-request', async (session) => {
    const result = await getHandlerResult(config.onGroupMemberRequest, session, false)
    if (result) return session.bot.handleGroupMemberRequest(session.messageId, ...result)
  })
}

export interface HandlerConfig {
  onRepeat?: RepeatHandler | StateCallback
  onInterrupt?: StateCallback
  onFriendRequest?: RequestHandler
  onGroupMemberRequest?: RequestHandler
  onGroupRequest?: RequestHandler
}

export default function apply(ctx: Context, config: HandlerConfig = {}) {
  ctx.plugin(repeater, config)
  ctx.plugin(verify, config)
}
