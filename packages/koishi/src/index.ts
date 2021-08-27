import { App, Context } from '@koishijs/core'
import { defineProperty, remove } from '@koishijs/utils'
import { Server, createServer } from 'http'
import { AxiosRequestConfig } from 'axios'
import Router from '@koa/router'
import type Koa from 'koa'

export * from './adapter'

export * from '@koishijs/core'
export * from '@koishijs/utils'

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

  interface AppOptions {
    port?: number
    host?: string
    axiosConfig?: AxiosRequestConfig
  }

  namespace Context {
    interface Delegates {
      router: Router
    }
  }

  interface EventMap {
    'exit'(signal: NodeJS.Signals): Promise<void>
  }
}

Context.delegate('router')

const prepare = App.prototype.prepare
App.prototype.prepare = function (this: App, ...args) {
  prepare.call(this, ...args)
  prepareServer.call(this)
}

function prepareServer(this: App) {
  const { port, host } = this.options
  if (!port) return

  // create server
  const koa: Koa = new (require('koa'))()
  this.router = new (require('@koa/router'))()
  koa.use(require('koa-bodyparser')())
  koa.use(this.router.routes())
  koa.use(this.router.allowedMethods())
  defineProperty(this, '_httpServer', createServer(koa.callback()))

  this.before('connect', () => {
    this._httpServer.listen(port, host)
    this.logger('server').info('server listening at %c', `http://${host || 'localhost'}:${port}`)
  })

  this.on('disconnect', () => {
    this.logger('server').info('http server closing')
    this._httpServer?.close()
  })
}

// hack into router methods to make sure
// that koa middlewares are disposable
const register = Router.prototype.register
Router.prototype.register = function (this: Router, ...args) {
  const layer = register.apply(this, args)
  const context: Context = this[Context.current]
  context?.state.disposables.push(() => {
    remove(this.stack, layer)
  })
  return layer
}
