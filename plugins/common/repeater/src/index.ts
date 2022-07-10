import { Context, Dict, Random, Schema, Session } from 'koishi'

interface RepeatState {
  content: string
  repeated: boolean
  times: number
  users: Dict<number>
}

type StateCallback = (state: RepeatState, session: Session) => void | string

interface RepeatHandler {
  minTimes?: number
  probability?: number
}

const RepeatHandler: Schema<RepeatHandler> = Schema.object({
  minTimes: Schema.natural().min(2).default(2).required().description('最少重复次数。'),
  probability: Schema.percent().default(1).description('复读发生概率。'),
})

function onRepeat(options: RepeatHandler | StateCallback): StateCallback {
  if (!options || typeof options !== 'object') return options as StateCallback
  const { minTimes = 2, probability = 1 } = options
  return ({ repeated, times, content }) => times >= minTimes && !repeated && Random.bool(probability) ? content : ''
}

export interface Config {
  onRepeat?: RepeatHandler | StateCallback
  onInterrupt?: StateCallback
}

export const name = 'repeater'
export const Config: Schema<Config> = Schema.object({
  onRepeat: Schema.union([RepeatHandler, Function]).description('响应复读消息'),
  onInterrupt: Schema.function().hidden().description('响应打断复读'),
})

export function apply(ctx: Context, config: Config = {}) {
  ctx = ctx.guild()

  const states: Dict<RepeatState> = {}

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
      return text && next(text)
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
