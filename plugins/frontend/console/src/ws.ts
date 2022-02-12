import { deserialize, serialize } from 'bson'
import { Awaitable, coerce, Context, Dict, Logger, WebSocketLayer } from 'koishi'
import { v4 } from 'uuid'
import WebSocket from 'ws'
import { DataService } from './service'

declare module 'koishi' {
  interface EventMap {
    'console/validate'(handle: SocketHandle): Awaitable<boolean>
  }
}

const logger = new Logger('console')

export class SocketHandle {
  readonly ctx: Context
  readonly id: string = v4()

  constructor(service: WsService, public socket: WebSocket) {
    this.ctx = service.ctx
  }

  send(payload: any) {
    this.socket.send(serialize(payload))
  }

  async validate() {
    return this.ctx.serial('console/validate', this)
  }
}

export type Listener = (this: SocketHandle, ...args: any[]) => Awaitable<any>

class WsService extends DataService {
  readonly handles: Dict<SocketHandle> = {}
  readonly listeners: Dict<Listener> = {}
  readonly layer: WebSocketLayer

  constructor(public ctx: Context, private config: WsService.Config) {
    super(ctx, 'ws')

    const { apiPath, selfUrl } = config
    ctx.console.global.endpoint = selfUrl + apiPath

    this.layer = ctx.router.ws(apiPath, this.onConnection)
  }

  broadcast(type: string, body: any) {
    if (!this?.layer.clients.size) return
    const data = serialize({ type, body })
    this.layer.clients.forEach((socket) => socket.send(data))
  }

  addListener(event: string, callback: Listener) {
    this.listeners[event] = callback
  }

  stop() {
    this.layer.close()
  }

  private onConnection = (socket: WebSocket) => {
    const handle = new SocketHandle(this, socket)
    this.handles[handle.id] = handle

    for (const name of Context.Services) {
      if (!name.startsWith('console.')) continue
      Promise.resolve(this.ctx[name]?.['get']?.()).then((value) => {
        if (!value) return
        const key = name.slice(8)
        socket.send(serialize({ type: 'data', body: { key, value } }))
      })
    }

    socket.on('message', async (data) => {
      if (await handle.validate()) return
      const { type, args, id } = deserialize(Array.isArray(data) ? Buffer.concat(data) : data)
      const listener = this.listeners[type]
      if (!listener) {
        logger.info('unknown message:', type, ...args)
        return handle.send({ type: 'response', body: { id } })
      }

      try {
        const value = await listener.call(handle, ...args)
        return handle.send({ type: 'response', body: { id, value } })
      } catch (e) {
        const error = coerce(e)
        return handle.send({ type: 'response', body: { id, error } })
      }
    })
  }
}

namespace WsService {
  export interface Config {
    selfUrl?: string
    apiPath?: string
  }
}

export default WsService
