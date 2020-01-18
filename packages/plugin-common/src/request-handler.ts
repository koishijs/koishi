import { App, Meta } from 'koishi-core'

type RequestHandler = string | boolean | ((meta: Meta<'request'>, app: App) => string | boolean | void | Promise<string | boolean | void>)

export interface HandlerOptions {
  handleFriend?: RequestHandler
  handleGroupAdd?: RequestHandler
  handleGroupInvite?: RequestHandler
}

const defaultHandlers: HandlerOptions = {
  async handleFriend (meta, app) {
    if (!app.database) return
    const user = await app.database.getUser(meta.userId, ['authority'])
    if (user.authority >= 1) return true
  },
  async handleGroupInvite (meta, app) {
    if (!app.database) return
    const user = await app.database.getUser(meta.userId, ['authority'])
    if (user.authority >= 4) return true
  },
}

async function getHandleResult (handler: RequestHandler, meta: Meta<'request'>, ctx: App) {
  return typeof handler === 'function' ? handler(meta, ctx) : handler
}

function setFriendResult (meta: Meta, result: string | boolean | void) {
  if (typeof result === 'boolean') {
    return result ? meta.$approve() : meta.$reject()
  } else if (typeof result === 'string') {
    return meta.$approve(result)
  }
}

function setGroupResult (meta: Meta, result: string | boolean | void) {
  if (typeof result === 'boolean') {
    return result ? meta.$approve() : meta.$reject()
  } else if (typeof result === 'string') {
    return meta.$reject(result)
  }
}

export default function apply (ctx: App, options: HandlerOptions = {}) {
  const { handleFriend, handleGroupAdd, handleGroupInvite } = { ...defaultHandlers, ...options }

  ctx.receiver.on('request/friend', async (meta) => {
    const result = await getHandleResult(handleFriend, meta, ctx)
    return setFriendResult(meta, result)
  })

  ctx.receiver.on('request/group/add', async (meta) => {
    const result = await getHandleResult(handleGroupAdd, meta, ctx)
    return setGroupResult(meta, result)
  })

  ctx.receiver.on('request/group/invite', async (meta) => {
    const result = await getHandleResult(handleGroupInvite, meta, ctx)
    return setGroupResult(meta, result)
  })
}
