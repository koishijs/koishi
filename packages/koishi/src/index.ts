import { App, Context, Modules } from '@koishijs/core'
import { trimSlash } from '@koishijs/utils'
import { Cache } from './cache'
import { Assets } from './assets'
import { Quester } from './quester'
import { Router } from './router'

export * from './adapter'
export * from './assets'
export * from './cache'
export * from './quester'
export * from './router'

export * from '@koishijs/core'
export * from '@koishijs/utils'

declare module '@koishijs/core' {
  interface App {
    baseDir: string
  }

  namespace Context {
    interface Services {
      assets: Assets
      cache: Cache
      http: Quester
      router: Router
    }
  }
}

// use node require
Modules.internal.require = require
Modules.internal.resolve = require.resolve

Context.service('assets')
Context.service('cache')
Context.service('http')
Context.service('router')

const prepare = App.prototype.prepare
App.prototype.prepare = function (this: App, ...args) {
  this.baseDir ??= process.cwd()
  this.http = Quester.create(this.options.request)
  prepare.call(this, ...args)
  Router.prepare(this)
}

const start = App.prototype.start
App.prototype.start = async function (this: App, ...args) {
  const { host = 'localhost', port, selfUrl } = this.options
  if (selfUrl) this.options.selfUrl = trimSlash(selfUrl)
  if (port) {
    await new Promise<void>(resolve => this._httpServer.listen(port, host, resolve))
    this.logger('app').info('server listening at %c', `http://${host}:${port}`)
    this.on('dispose', () => {
      this.logger('app').info('http server closing')
      this._wsServer?.close()
      this._httpServer?.close()
    })
  }
  return start.call(this, ...args)
}
