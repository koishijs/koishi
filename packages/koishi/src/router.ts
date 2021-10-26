import { App, Context } from '@koishijs/core'
import { defineProperty, MaybeArray, remove, Schema } from '@koishijs/utils'
import { Server, createServer } from 'http'
import KoaRouter from '@koa/router'
import type Koa from 'koa'

declare module 'koa' {
  // koa-bodyparser
  interface Request {
    body?: any
    rawBody?: string
  }
}

declare module '@koishijs/core' {
  interface App {
    _httpServer?: Server
  }

  namespace App {
    interface Config {
      baseDir?: string
    }

    namespace Config {
      interface Network {
        port?: number
        host?: string
      }
    }
  }
}

App.Config.Network.dict = {
  host: Schema.string('要监听的 IP 地址。如果将此设置为 `0.0.0.0` 将监听所有地址，包括局域网和公网地址。'),
  port: Schema.number('要监听的端口。'),
  ...App.Config.Network.dict,
}

export interface Router<S = Koa.DefaultState, C = Koa.DefaultContext> extends KoaRouter<S, C> {
  websocket(path: MaybeArray<string | RegExp>, ...middleware: KoaRouter.Middleware<S, C>[]): Router<S, C>
}

export namespace Router {
  export function prepare(app: App) {
    app.options.baseDir ||= process.cwd()

    const { port, host } = app.options
    if (!port) return

    // create server
    const koa: Koa = new (require('koa'))()
    app.router = new (require('@koa/router'))()
    koa.use(require('koa-bodyparser')())
    koa.use(app.router.routes())
    koa.use(app.router.allowedMethods())
    defineProperty(app, '_httpServer', createServer(koa.callback()))

    app.on('connect', () => {
      app._httpServer.listen(port, host)
      app.logger('app').info('server listening at %c', `http://${host || 'localhost'}:${port}`)
    })

    app.on('disconnect', () => {
      app.logger('app').info('http server closing')
      app._httpServer?.close()
    })
  }
}

// hack into router methods to make sure
// that koa middlewares are disposable
const register = KoaRouter.prototype.register
KoaRouter.prototype.register = function (this: KoaRouter, ...args) {
  const layer = register.apply(this, args)
  const context: Context = this[Context.current]
  context?.state.disposables.push(() => {
    remove(this.stack, layer)
  })
  return layer
}
