import { App, Meta } from 'koishi-core'

type RequestHandler = string | boolean | ((meta: Meta, app: App) => string | boolean | void | Promise<string | boolean | void>)

export interface HandlerOptions {
  handleFriend?: RequestHandler
  handleGroupAdd?: RequestHandler
  handleGroupInvite?: RequestHandler
}

async function getHandleResult (handler: RequestHandler, meta: Meta, ctx: App) {
  return typeof handler === 'function' ? handler(meta, ctx) : handler
}

export default function apply (ctx: App, options: HandlerOptions = {}) {
  const { handleFriend, handleGroupAdd, handleGroupInvite } = options

  ctx.on('request/friend', async (meta) => {
    const result = await getHandleResult(handleFriend, meta, ctx)
    return result !== undefined && ctx.sender.setFriendAddRequestAsync(meta.flag, result as any)
  })

  ctx.on('request/group/add', async (meta) => {
    const result = await getHandleResult(handleGroupAdd, meta, ctx)
    return result !== undefined && ctx.sender.setGroupAddRequestAsync(meta.flag, meta.subType as any, result as any)
  })

  ctx.on('request/group/invite', async (meta) => {
    const result = await getHandleResult(handleGroupInvite, meta, ctx)
    return result !== undefined && ctx.sender.setGroupAddRequestAsync(meta.flag, meta.subType as any, result as any)
  })
}
