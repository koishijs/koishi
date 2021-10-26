import { App, Modules, Service } from '@koishijs/core'
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
  namespace Service {
    interface Injection {
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

Service.register('assets')
Service.register('cache')
Service.register('http')
Service.register('router')

const prepare = App.prototype.prepare
App.prototype.prepare = function (this: App, ...args) {
  this.http = Quester.create(this.options.request)
  this.plugin(require('@koishijs/plugin-cache-lru'))
  prepare.call(this, ...args)
  Router.prepare(this)
}
