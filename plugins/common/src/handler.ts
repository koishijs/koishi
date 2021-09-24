import { Context, Session, Random, Dict, Awaitable } from 'koishi'

type RequestHandler = string | boolean | ((session: Session) => Awaitable<string | boolean | void>)
type Response = [boolean, string?]

async function useRequestHandler(handler: RequestHandler, session: Session, prefer: boolean): Promise<Response> {
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

export interface VerifierConfig {
  onFriendRequest?: number | RequestHandler
  onGuildMemberRequest?: number | RequestHandler
  onGuildRequest?: number | RequestHandler
}

export function verifier(ctx: Context, config: VerifierConfig = {}) {
  const { onFriendRequest, onGuildRequest, onGuildMemberRequest } = config

  ctx.on('friend-request', async (session) => {
    const result = typeof onFriendRequest === 'number'
      ? await checkUserAuthority(session, onFriendRequest)
      : await useRequestHandler(onFriendRequest, session, true)
    if (result) return session.bot.handleFriendRequest(session.messageId, ...result)
  })

  ctx.on('guild-request', async (session) => {
    const result = typeof onGuildRequest === 'number'
      ? await checkChannelAuthority(session, onGuildRequest)
      : await useRequestHandler(onGuildRequest, session, false)
    if (result) return session.bot.handleGuildRequest(session.messageId, ...result)
  })

  ctx.on('guild-member-request', async (session) => {
    const result = typeof onGuildMemberRequest === 'number'
      ? await checkUserAuthority(session, onGuildMemberRequest)
      : await useRequestHandler(onGuildMemberRequest, session, false)
    if (result) return session.bot.handleGuildMemberRequest(session.messageId, ...result)
  })
}

export interface HandlerConfig extends VerifierConfig {}

export default function apply(ctx: Context, config?: HandlerConfig) {
  ctx.plugin(verifier, config)
}
