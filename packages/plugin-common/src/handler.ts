import { App, Session, simplify } from 'koishi-core'

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

export type RequestHandler = string | boolean | ((session: Session) => Awaited<string | boolean>)

export interface HandlerOptions {
  onFriendRequest?: RequestHandler
  onGroupMemberRequest?: RequestHandler
  onGroupRequest?: RequestHandler
  respondents?: Respondent[]
}

async function getHandleResult(handler: RequestHandler, session: Session, prefer: boolean): Promise<[boolean, string?]> {
  const result = typeof handler === 'function' ? await handler(session) : handler
  if (typeof result === 'string') {
    return [prefer, result]
  } else if (result !== undefined) {
    return [result]
  }
}

export default function apply(ctx: App, options: HandlerOptions = {}) {
  ctx.on('friend-request', async (session) => {
    const result = await getHandleResult(options.onFriendRequest, session, true)
    return session.bot.handleFriendRequest(session.messageId, ...result)
  })

  ctx.on('group-request', async (session) => {
    const result = await getHandleResult(options.onGroupRequest, session, false)
    return session.bot.handleGroupRequest(session.messageId, ...result)
  })

  ctx.on('group-member-request', async (session) => {
    const result = await getHandleResult(options.onGroupMemberRequest, session, false)
    return session.bot.handleGroupMemberRequest(session.messageId, ...result)
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
}
