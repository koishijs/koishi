import { Awaitable, coerce, Context, Dict, Logger, WebSocketLayer } from 'koishi'
import { v4 } from 'uuid'
import { DataService } from './service'
import WebSocket from 'ws'

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
    this.socket.send(JSON.stringify(payload))
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
    const data = JSON.stringify({ type, body })
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
        socket.send(JSON.stringify({ type: 'data', body: { key, value } }))
      })
    }

    socket.on('message', async (data) => {
      if (await handle.validate()) return
      const { type, args, id } = JSON.parse(data.toString())
      const listener = this.listeners[type]
      if (!listener) {
        logger.info('unknown message:', type, ...args)
        return handle.send({ type: 'response', body: { id } })
      }

      try {
        const value = await listener.call(handle, ...args)
        return handle.send({ type: 'response', body: { id, value } })
      } catch (error) {
        error = coerce(error)
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
