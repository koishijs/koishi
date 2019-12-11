import { App, Meta } from 'koishi-core'

type RequestHandler = boolean | ((meta: Meta<'request'>, app: App) => boolean | void | Promise<boolean | void>)

export interface HandlerOptions {
  handleFriend?: RequestHandler
  handleGroupAdd?: RequestHandler
  handleGroupInvite?: RequestHandler
}

const defaultHandlers: HandlerOptions = {
  async handleFriend (meta, app) {
    const user = await app.database.getUser(meta.userId, 0, ['authority'])
    if (user.authority >= 1) return true
  },
  async handleGroupInvite (meta, app) {
    const user = await app.database.getUser(meta.userId, 0, ['authority'])
    if (user.authority >= 4) return true
  },
}

async function getHandleResult (handler: RequestHandler, meta: Meta<'request'>, ctx: App) {
  return typeof handler === 'function' ? handler(meta, ctx) : handler
}

export default function apply (ctx: App, options: HandlerOptions = {}) {
  const { handleFriend, handleGroupAdd, handleGroupInvite } = { ...defaultHandlers, ...options }

  ctx.users.receiver.on('request', async (meta) => {
    const result = await getHandleResult(handleFriend, meta, ctx)
    if (typeof result === 'boolean') {
      await ctx.sender.setFriendAddRequest(meta.flag, result)
    }
  })

  ctx.groups.receiver.on('request/add', async (meta) => {
    const result = await getHandleResult(handleGroupAdd, meta, ctx)
    if (typeof result === 'boolean') {
      await ctx.sender.setGroupAddRequest(meta.flag, 'add', result)
    }
  })

  ctx.groups.receiver.on('request/invite', async (meta) => {
    const result = await getHandleResult(handleGroupInvite, meta, ctx)
    if (typeof result === 'boolean') {
      await ctx.sender.setGroupAddRequest(meta.flag, 'invite', result)
    }
  })
}
