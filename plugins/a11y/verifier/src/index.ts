import { Awaitable, Context, Schema, Session } from 'koishi'

type RequestHandler = number | GeneralHandler
type GeneralHandler = string | boolean | ((session: Session) => Awaitable<string | boolean | void>)
type Response = [approve: boolean, comment?: string]

const RequestHandler: Schema<RequestHandler> = Schema.union([
  Schema.const(undefined).description('无操作'),
  Schema.const(true).description('全部通过'),
  Schema.const(false).description('全部拒绝'),
  Schema.natural().description('权限等级').default(0),
  Schema.string().hidden(),
  Schema.function().hidden(),
])

async function useGeneralHandler(handler: GeneralHandler, session: Session, prefer: boolean): Promise<Response> {
  const result = typeof handler === 'function' ? await handler(session) : handler
  if (typeof result === 'string') {
    return [prefer, result]
  } else if (typeof result === 'boolean') {
    return [result]
  }
}

async function checkUserAuthority(session: Session, authority: number): Promise<Response> {
  const user = await session.observeUser(['authority'])
  if (user.authority >= authority) return [true]
}

async function checkChannelAuthority(session: Session, authority: number): Promise<Response> {
  const channel = await session.observeChannel(['assignee'])
  if (channel.assignee) return [true]
  const user = await session.observeUser(['authority'])
  if (user.authority >= authority) {
    channel.assignee = session.selfId
    await channel.$update()
    return [true]
  }
}

export const name = 'verifier'

export interface Config {
  onFriendRequest?: RequestHandler
  onGuildMemberRequest?: RequestHandler
  onGuildRequest?: RequestHandler
}

export const Config: Schema<Config> = Schema.object({
  onFriendRequest: RequestHandler.description('如何响应好友请求？'),
  onGuildMemberRequest: RequestHandler.description('如何响应入群申请？'),
  onGuildRequest: RequestHandler.description('如何响应入群邀请？'),
})

export function apply(ctx: Context, config: Config = {}) {
  const { onFriendRequest, onGuildRequest, onGuildMemberRequest } = config

  ctx.on('friend-request', async (session) => {
    const result = typeof onFriendRequest === 'number'
      ? await checkUserAuthority(session, onFriendRequest)
      : await useGeneralHandler(onFriendRequest, session, true)
    if (result) return session.bot.handleFriendRequest(session.messageId, ...result)
  })

  ctx.on('guild-request', async (session) => {
    const result = typeof onGuildRequest === 'number'
      ? await checkChannelAuthority(session, onGuildRequest)
      : await useGeneralHandler(onGuildRequest, session, false)
    if (result) return session.bot.handleGuildRequest(session.messageId, ...result)
  })

  ctx.on('guild-member-request', async (session) => {
    const result = typeof onGuildMemberRequest === 'number'
      ? await checkUserAuthority(session, onGuildMemberRequest)
      : await useGeneralHandler(onGuildMemberRequest, session, false)
    if (result) return session.bot.handleGuildMemberRequest(session.messageId, ...result)
  })
}
