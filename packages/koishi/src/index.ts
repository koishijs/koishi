import { App, Context, Modules } from '@koishijs/core'
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
  this.http = Quester.create(this.options.request)
  prepare.call(this, ...args)
  Router.prepare(this)
}
