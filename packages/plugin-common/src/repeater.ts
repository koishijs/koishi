import { Context, Session } from 'koishi-core'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'repeater'(session: Session, state: RepeatState): void
  }
}

interface RepeatState {
  message: string
  repeated: boolean
  times: number
  users: Record<number, number>
}

type RepeatHandler = (state: RepeatState, message: string, userId: number) => void | string

export interface RepeaterOptions {
  onRepeat?: RepeatHandler
  onInterrupt?: RepeatHandler
}

export default function apply(ctx: Context, options: RepeaterOptions = {}) {
  ctx = ctx.group()

  const states: Record<number, RepeatState> = {}

  function getState(groupId: number) {
    return states[groupId] || (states[groupId] = {
      message: '',
      repeated: false,
      times: 0,
      users: {},
    })
  }

  ctx.on('before-send', ({ groupId, message }) => {
    const state = getState(groupId)
    state.repeated = true
    if (state.message === message) {
      state.times += 1
    } else {
      state.message = message
      state.times = 1
      state.users = {}
    }
  })

  ctx.middleware((session, next) => {
    const { message, groupId, userId } = session

    // never respond to messages from self
    if (ctx.bots[userId]) return

    const state = getState(groupId)
    const check = (handle: RepeatHandler) => {
      const text = handle?.(state, message, userId)
      return text && next(() => {
        ctx.emit('repeater', session, state)
        return session.$send(text)
      })
    }

    // duplicate repeating & normal repeating
    if (message === state.message) {
      state.times += 1
      state.users[userId] = (state.users[userId] || 0) + 1
      return check(options.onRepeat) || next()
    }

    // interrupt repeating
    const result = check(options.onInterrupt)
    if (result) return result

    // unrepeated message
    state.message = message
    state.repeated = false
    state.times = 1
    state.users = { [userId]: 1 }
    return next()
  })
}
