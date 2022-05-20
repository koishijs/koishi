import { App, Context, Schema } from '@koishijs/core'
import { Cache } from './cache'
import { Assets } from './assets'
import { Quester } from './quester'
import { Router } from './router'

export * from './adapter'
export * from './assets'
export * from './cache'
export * from './patch'
export * from './quester'
export * from './router'

export * from '@koishijs/core'
export * from '@koishijs/utils'

declare module '@koishijs/core' {
  interface Context {
    assets: Assets
    cache: Cache
    http: Quester
    router: Router
  }
}

App.Config.list.unshift(App.Config.Network)
App.Config.list.push(Schema.object({
  request: Quester.Config,
  assets: App.Config.Assets,
}))

Context.service('assets')
Context.service('cache')
Context.service('http', {
  constructor: Quester,
})
Context.service('router', {
  constructor: Router,
})
