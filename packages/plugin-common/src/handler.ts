import { App, Session } from 'koishi-core'
import { simplify, makeArray } from 'koishi-utils'
import {} from 'koishi-adapter-onebot'

export interface Respondent {
  match: string | RegExp
  reply: string | ((...capture: string[]) => string)
}

export interface ThrottleConfig {
  interval: number
  messages: number
}

// TODO pending typescript official helper
type Awaited<T> = T | Promise<T>

export type RequestHandler = string | boolean | ((session: Session) => Awaited<string | boolean | void>)

export interface HandlerOptions {
  onFriend?: RequestHandler
  onGroupAdd?: RequestHandler
  onGroupInvite?: RequestHandler
  respondents?: Respondent[]
  throttle?: ThrottleConfig | ThrottleConfig[]
}

type CQSession = Session<never, never, 'onebot'>

async function getHandleResult(handler: RequestHandler, session: CQSession): Promise<any> {
  // FIXME
  return typeof handler === 'function' ? handler(session as any) : handler
}

export default function apply(ctx: App, options: HandlerOptions = {}) {
  ctx.on('friend-request', async (session: CQSession) => {
    const result = await getHandleResult(options.onFriend, session)
    return result !== undefined && session.$bot.setFriendAddRequest(session.flag, result)
  })

  // FIXME: subtype
  ctx.on('group-member-request', async (session: CQSession) => {
    const result = await getHandleResult(options.onGroupAdd, session)
    return result !== undefined && session.$bot.setGroupAddRequest(session.flag, session.subtype as any, result)
  })

  ctx.on('group-request', async (session: CQSession) => {
    const result = await getHandleResult(options.onGroupInvite, session)
    return result !== undefined && session.$bot.setGroupAddRequest(session.flag, session.subtype as any, result)
  })

  const { respondents = [] } = options

  respondents.length && ctx.middleware((session, next) => {
    const message = simplify(session.content)
    for (const { match, reply } of respondents) {
      const capture = typeof match === 'string' ? message === match && [message] : message.match(match)
      if (capture) return session.send(typeof reply === 'string' ? reply : reply(...capture))
    }
    return next()
  })

  const throttleConfig = makeArray(options.throttle)
  if (throttleConfig.length) {
    const counters: Record<number, number> = {}
    for (const { interval, messages } of throttleConfig) {
      counters[interval] = messages
    }

    ctx.before('send', () => {
      for (const { interval } of throttleConfig) {
        counters[interval]--
        setTimeout(() => counters[interval]++, interval)
      }
    })

    ctx.middleware((session, next) => {
      for (const interval in counters) {
        if (counters[interval] <= 0) return
      }
      return next()
    }, true)
  }
}
