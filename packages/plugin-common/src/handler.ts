import { App, Meta } from 'koishi-core'
import { simplify } from 'koishi-utils'

export interface Respondent {
  match: string | RegExp
  reply: string | ((...capture: string[]) => string)
}

export interface ThrottleConfig {
  interval: number
  messages: number
}

// TODO pending typescript official helper
type Awaited <T> = T | Promise<T>

export type RequestHandler = string | boolean | ((meta: Meta) => Awaited<string | boolean | void>)
export type WelcomeMessage = string | ((meta: Meta) => string | Promise<string>)

export interface HandlerOptions {
  onFriend?: RequestHandler
  onGroupAdd?: RequestHandler
  onGroupInvite?: RequestHandler
  blackList?: string[]
  respondents?: Respondent[]
  throttle?: ThrottleConfig | ThrottleConfig[]
  welcome?: WelcomeMessage
}

const defaultMessage: WelcomeMessage = meta => `欢迎新大佬 [CQ:at,qq=${meta.userId}]！`

async function getHandleResult (handler: RequestHandler, meta: Meta) {
  return typeof handler === 'function' ? handler(meta) : handler
}

export default function apply (ctx: App, options: HandlerOptions = {}) {
  ctx.on('request/friend', async (meta) => {
    const result = await getHandleResult(options.onFriend, meta)
    return result !== undefined && ctx.sender(meta.selfId).setFriendAddRequest(meta.flag, result as any)
  })

  ctx.on('request/group/add', async (meta) => {
    const result = await getHandleResult(options.onGroupAdd, meta)
    return result !== undefined && ctx.sender(meta.selfId).setGroupAddRequest(meta.flag, meta.subType as any, result as any)
  })

  ctx.on('request/group/invite', async (meta) => {
    const result = await getHandleResult(options.onGroupInvite, meta)
    return result !== undefined && ctx.sender(meta.selfId).setGroupAddRequest(meta.flag, meta.subType as any, result as any)
  })

  const { blackList = [], respondents = [], throttle, welcome = defaultMessage } = options

  blackList.length && ctx.prependMiddleware((meta, next) => {
    for (const word of blackList) {
      if (meta.message.includes(word)) return
    }
    return next()
  })

  respondents.length && ctx.middleware((meta, next) => {
    const message = simplify(meta.message)
    for (const { match, reply } of respondents) {
      const capture = typeof match === 'string' ? message === match && [message] : message.match(match)
      if (capture) return meta.$send(typeof reply === 'string' ? reply : reply(...capture))
    }
    return next()
  })

  const throttleConfig = !throttle ? [] : Array.isArray(throttle) ? throttle : [throttle]
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

    ctx.prependMiddleware((meta, next) => {
      for (const interval in counters) {
        if (counters[interval] <= 0) return
      }
      return next()
    })
  }

  ctx.on('group-increase', async (meta) => {
    if (ctx.app.bots[meta.userId]) return
    if (ctx.database) {
      const group = await ctx.database.getGroup(meta.groupId, 0, ['assignee'])
      if (group.assignee !== meta.selfId) return
    }
    const output = typeof welcome === 'string' ? welcome : await welcome(meta)
    await ctx.sender(meta.selfId).sendGroupMsg(meta.groupId, output)
  })
}
