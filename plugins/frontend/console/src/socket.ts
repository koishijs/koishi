import { App, Awaitable, coerce, Context, Dict, Logger, WebSocketLayer } from 'koishi'
import { v4 } from 'uuid'
import WebSocket from 'ws'
import { DataService } from './service'

declare module 'koishi' {
  interface Events {
    'console/intercept'(handle: SocketHandle, listener: DataService.Options): Awaitable<boolean>
  }
}

const logger = new Logger('console')

export class SocketHandle {
  readonly app: App
  readonly id: string = v4()

  constructor(service: WsService, public socket: WebSocket) {
    this.app = service.ctx.app
    this.refresh()
  }

  send(payload: any) {
    this.socket.send(JSON.stringify(payload))
  }

  refresh() {
    DataService.keys.forEach(async (key) => {
      const service = this.app[`console.${key}`] as DataService
      if (!service) return
      if (await this.app.serial('console/intercept', this, service.options)) {
        return this.send({ type: 'data', body: { key, value: null } })
      }

      try {
        const value = await service.get()
        if (!value) return
        this.send({ type: 'data', body: { key, value } })
      } catch (error) {
        this.app.logger('console').warn(error)
      }
    })
  }
}

export interface Listener extends DataService.Options {
  callback: Listener.Callback
}

export namespace Listener {
  export type Callback = (this: SocketHandle, ...args: any[]) => Awaitable<any>
}

class WsService extends DataService {
  readonly handles: Dict<SocketHandle> = {}
  readonly listeners: Dict<Listener> = {}
  readonly layer: WebSocketLayer

  constructor(public ctx: Context, private config: WsService.Config) {
    super(ctx, 'ws')

    this.layer = ctx.router.ws(config.apiPath, this.onConnection)
  }

  broadcast(type: string, body: any, options: DataService.Options = {}) {
    const handles = Object.values(this.handles)
    if (!handles.length) return
    const data = JSON.stringify({ type, body })
    Promise.all(Object.values(this.handles).map(async (handle) => {
      if (await this.ctx.serial('console/intercept', handle, options)) return
      handle.socket.send(data)
    }))
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
