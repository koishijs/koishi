import { App, Meta } from 'koishi-core'

type RequestHandler = boolean | ((meta: Meta<'request'>, app: App) => string | boolean | void | Promise<string | boolean | void>)

export interface HandlerConfig {
  handleFriend?: RequestHandler
  handleGroupAdd?: RequestHandler
  handleGroupInvite?: RequestHandler
}

const defaultHandlers: HandlerConfig = {
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

export default function apply (ctx: App, options: HandlerConfig = {}) {
  const { handleFriend, handleGroupAdd, handleGroupInvite } = { ...defaultHandlers, ...options }

  ctx.users.receiver.on('request/friend', async (meta) => {
    const result = await getHandleResult(handleFriend, meta, ctx)
    if (typeof result === 'boolean') {
      return result ? meta.$approve() : meta.$reject()
    } else if (typeof result === 'string') {
      return meta.$approve(result)
    }
  })

  ctx.groups.receiver.on('request/group/add', async (meta) => {
    const result = await getHandleResult(handleGroupAdd, meta, ctx)
    if (typeof result === 'boolean') {
      return result ? meta.$approve() : meta.$reject()
    } else if (typeof result === 'string') {
      return meta.$reject(result)
    }
  })

  ctx.groups.receiver.on('request/group/invite', async (meta) => {
    const result = await getHandleResult(handleGroupInvite, meta, ctx)
    if (typeof result === 'boolean') {
      return result ? meta.$approve() : meta.$reject()
    } else if (typeof result === 'string') {
      return meta.$reject(result)
    }
  })
}
