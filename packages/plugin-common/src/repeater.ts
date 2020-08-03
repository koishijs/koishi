import { Context, Session } from 'koishi-core'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'repeater' (session: Session, state: RepeatState): void
  }
}

interface RepeatState {
  message: string
  repeated: boolean
  times: number
  assignee: number
  users: Record<number, number>
}

type RepeatHandler = (state: RepeatState, message: string, userId: number) => void | string

export interface RepeaterOptions {
  onRepeat?: RepeatHandler
  onDuplicateRepeat?: RepeatHandler
  onInterruptRepeat?: RepeatHandler
}

export default function apply (ctx: Context, options: RepeaterOptions = {}) {
  ctx = ctx.group()

  const states: Record<number, RepeatState> = {}

  function getState (groupId: number, assignee: number) {
    return states[groupId] || (states[groupId] = {
      message: '',
      repeated: false,
      times: 0,
      assignee,
      users: {},
    })
  }

  ctx.on('before-send', ({ groupId, message, selfId }) => {
    const state = getState(groupId, selfId)
    state.repeated = true
    if (state.message === message) {
      state.times += 1
    } else {
      state.message = message
      state.times = 1
      state.users = {}
    }
  })

  ctx.prependMiddleware((session, next) => {
    const { message, groupId, userId, selfId } = session

    // never respond to messages from self
    if (ctx.app.bots[userId]) return

    const state = getState(groupId, selfId)
    const check = (handle: RepeatHandler) => {
      const text = handle && handle(state, message, userId)
      return text && next(() => {
        ctx.emit('repeater', session, state)
        return session.$send(text)
      })
    }

    if (message === state.message) {
      // avoid duplicate counting
      if (state.assignee === selfId) {
        state.times += 1
        state.users[userId] = (state.users[userId] || 0) + 1
      }

      // duplicate repeating & normal repeating
      return state.users[userId] > 1 && check(options.onDuplicateRepeat)
        || state.times > 1 && check(options.onRepeat)
        || next()
    } else {
      // interrupt repeating
      const result = check(options.onInterruptRepeat)
      if (result) return result

      // unrepeated message
      state.message = message
      state.repeated = false
      state.times = 1
      state.users = { [userId]: 1 }
      return next()
    }
  })
}
