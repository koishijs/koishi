import { App, Awaitable, coerce, Context, Dict, Logger, WebSocketLayer } from 'koishi'
import { v4 } from 'uuid'
import WebSocket from 'ws'
import { DataService } from './service'

declare module 'koishi' {
  interface EventMap {
    'console/intercept'(handle: SocketHandle, listener: Listener): Awaitable<boolean>
  }
}

const logger = new Logger('console')

export class SocketHandle {
  readonly app: App
  readonly id: string = v4()

  constructor(service: WsService, public socket: WebSocket) {
    this.app = service.ctx.app
  }

  send(payload: any) {
    this.socket.send(JSON.stringify(payload))
  }
}

export interface Listener extends Listener.Options {
  callback: Listener.Callback
}

export namespace Listener {
  export type Callback = (this: SocketHandle, ...args: any[]) => Awaitable<any>

  export interface Options {
    authority?: number
  }
}

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

  addListener(event: string, listener: Listener) {
    this.listeners[event] = listener
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
      const { type, args, id } = JSON.parse(data.toString())
      const listener = this.listeners[type]
      if (!listener) {
        logger.info('unknown message:', type, ...args)
        return handle.send({ type: 'response', body: { id, error: 'not implemented' } })
      }

      if (await this.ctx.serial('console/intercept', handle, listener)) {
        return handle.send({ type: 'response', body: { id, error: 'unauthorized' } })
      }

      try {
        const value = await listener.callback.call(handle, ...args)
        return handle.send({ type: 'response', body: { id, value } })
      } catch (e) {
        logger.debug(e)
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
