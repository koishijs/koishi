import { App, Session } from 'koishi-core'
import { simplify, makeArray } from 'koishi-utils'
import {} from 'koishi-adapter-cqhttp'

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
export type WelcomeMessage = string | ((session: Session) => string | Promise<string>)

export interface HandlerOptions {
  onFriend?: RequestHandler
  onGroupAdd?: RequestHandler
  onGroupInvite?: RequestHandler
  respondents?: Respondent[]
  throttle?: ThrottleConfig | ThrottleConfig[]
  welcome?: WelcomeMessage
}

const defaultMessage: WelcomeMessage = session => `欢迎新大佬 [CQ:at,qq=${session.userId}]！`

async function getHandleResult(handler: RequestHandler, session: Session): Promise<any> {
  return typeof handler === 'function' ? handler(session) : handler
}

export default function apply(ctx: App, options: HandlerOptions = {}) {
  ctx.on('request/friend', async (session) => {
    const result = await getHandleResult(options.onFriend, session)
    return result !== undefined && session.$bot.setFriendAddRequest(session.flag, result)
  })

  ctx.on('request/group/add', async (session) => {
    const result = await getHandleResult(options.onGroupAdd, session)
    return result !== undefined && session.$bot.setGroupAddRequest(session.flag, session.subType, result)
  })

  ctx.on('request/group/invite', async (session) => {
    const result = await getHandleResult(options.onGroupInvite, session)
    return result !== undefined && session.$bot.setGroupAddRequest(session.flag, session.subType, result)
  })

  const { respondents = [], welcome = defaultMessage } = options

  respondents.length && ctx.middleware((session, next) => {
    const message = simplify(session.message)
    for (const { match, reply } of respondents) {
      const capture = typeof match === 'string' ? message === match && [message] : message.match(match)
      if (capture) return session.$send(typeof reply === 'string' ? reply : reply(...capture))
    }
    return next()
  })

  const throttleConfig = makeArray(options.throttle)
  if (throttleConfig.length) {
    const counters: Record<number, number> = {}
    for (const { interval, messages } of throttleConfig) {
      counters[interval] = messages
    }

    ctx.on('before-send', () => {
      for (const { interval } of throttleConfig) {
        counters[interval]--
        setTimeout(() => counters[interval]++, interval)
      }
    })

    ctx.prependMiddleware((session, next) => {
      for (const interval in counters) {
        if (counters[interval] <= 0) return
      }
      return next()
    })
  }

  ctx.on('group-increase', async (session) => {
    if (ctx.bots[session.userId]) return
    if (ctx.database) {
      const group = await ctx.database.getGroup(session.groupId, 0, ['assignee'])
      if (group.assignee !== session.selfId) return
    }
    const output = typeof welcome === 'string' ? welcome : await welcome(session)
    await session.$bot.sendGroupMsg(session.groupId, output)
  })
}
