import { Context, Session } from 'koishi-core'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'repeater'(session: Session, state: RepeatState): void
  }
}

interface RepeatState {
  content: string
  repeated: boolean
  times: number
  users: Record<number, number>
}

type RepeatHandler = (state: RepeatState, content: string, userId: string) => void | string

export interface RepeaterOptions {
  onRepeat?: RepeatHandler
  onInterrupt?: RepeatHandler
}

export default function apply(ctx: Context, options: RepeaterOptions = {}) {
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
    const { content, kind, userId } = session

    // never respond to messages from self
    if (ctx.servers[kind].bots[userId]) return

    const state = getState(session.cid)
    const check = (handle: RepeatHandler) => {
      const text = handle?.(state, content, userId)
      return text && next(() => {
        ctx.emit('repeater', session, state)
        return session.send(text)
      })
    }

    // duplicate repeating & normal repeating
    if (content === state.content) {
      state.times += 1
      state.users[userId] = (state.users[userId] || 0) + 1
      return check(options.onRepeat) || next()
    }

    // interrupt repeating
    const result = check(options.onInterrupt)
    if (result) return result

    // unrepeated message
    state.content = content
    state.repeated = false
    state.times = 1
    state.users = { [userId]: 1 }
    return next()
  })
}
