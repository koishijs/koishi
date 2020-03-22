import { Context, Meta } from 'koishi-core'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'repeater/repeat' (meta: Meta<'message'>, state: State): void
    'repeater/interrupt' (meta: Meta<'message'>, state: State): void
    'repeater/check-repeat' (meta: Meta<'message'>, state: State): void
    'repeater/check-interrupt' (meta: Meta<'message'>, state: State): void
  }
}

interface State {
  message: string
  repeated: boolean
  times: number
  users: Set<number>
}

type SessionSwitch = boolean | ((repeated: boolean, times: number, message: string) => boolean)
type SessionText = string | ((userId: number, message: string) => string)

export interface RepeaterOptions {
  repeat?: SessionSwitch
  interrupt?: SessionSwitch
  repeatCheck?: SessionSwitch
  interruptCheck?: SessionSwitch
  interruptText?: SessionText
  repeatCheckText?: SessionText
  interruptCheckText?: SessionText
}

const defaultOptions: RepeaterOptions = {
  repeat: false,
  interrupt: false,
  interruptText: '打断复读！',
  repeatCheck: false,
  repeatCheckText: (userId) => `[CQ:at,qq=${userId}] 在？为什么重复复读？`,
  interruptCheck: false,
  interruptCheckText: (userId) => `[CQ:at,qq=${userId}] 在？为什么打断复读？`,
}

function getSwitch (sessionSwitch: SessionSwitch, repeated: boolean, times: number, message: string) {
  return typeof sessionSwitch === 'boolean' ? sessionSwitch : sessionSwitch(repeated, times, message)
}

function getText (sessionText: SessionText, userId: number, message: string) {
  return typeof sessionText === 'string' ? sessionText : sessionText(userId, message)
}

export default function apply (ctx: Context, options: RepeaterOptions) {
  options = { ...defaultOptions, ...options }
  ctx = ctx.intersect(ctx.app.groups)

  const states: Record<number, State> = {}

  function getState (groupId: number) {
    if (!states[groupId]) {
      states[groupId] = {
        message: '',
        repeated: false,
        times: 0,
        users: new Set(),
      }
    }
    return states[groupId]
  }

  ctx.on('before-send', ({ groupId, message }) => {
    const state = getState(groupId)
    state.repeated = true
    if (state.message === message) {
      state.times += 1
    } else {
      state.message = message
      state.times = 1
      state.users.clear()
    }
  })

  ctx.prependMiddleware((meta, next) => {
    const { message, groupId, userId, $send } = meta
    const state = getState(groupId)
    if (message === state.message) {
      if (state.users.has(userId) && getSwitch(options.repeatCheck, state.repeated, state.times, message)) {
        return next(() => {
          ctx.emit('repeater/check-repeat', meta, state)
          return $send(getText(options.repeatCheckText, userId, message))
        })
      }
      state.times += 1
      state.users.add(userId)
      if (getSwitch(options.interrupt, state.repeated, state.times, message)) {
        return next(() => {
          ctx.emit('repeater/interrupt', meta, state)
          return $send(getText(options.interruptText, userId, message))
        })
      }
      if (getSwitch(options.repeat, state.repeated, state.times, message)) {
        return next(() => {
          ctx.emit('repeater/repeat', meta, state)
          return $send(message)
        })
      }
    } else {
      if (getSwitch(options.interruptCheck, state.repeated, state.times, message)) {
        return next(() => {
          ctx.emit('repeater/check-interrupt', meta, state)
          return $send(getText(options.interruptCheckText, userId, message))
        })
      }
      state.message = message
      state.repeated = false
      state.times = 1
      state.users = new Set([userId])
    }
    return next()
  })
}
