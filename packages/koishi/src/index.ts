import { Context, Schema } from '@koishijs/core'
import { defineProperty } from '@koishijs/utils'
import { Assets } from './assets'
import * as satori from '@satorijs/core'

export { Router, WebSocketLayer } from '@satorijs/satori'

export * from './assets'
export * from './patch'

export * from '@koishijs/core'
export * from '@koishijs/utils'

declare module '@koishijs/core' {
  interface Context {
    assets: Assets
    cache: Cache
  }

  namespace Context {
    namespace Config {
      interface Static {
        Network: satori.Context.Config.Network
      }
    }
  }
}

defineProperty(Context.Config, 'Network', satori.Context.Config.Network)

Context.Config.list.unshift(satori.Context.Config.Network)

Context.Config.list.push(Schema.object({
  assets: Context.Config.Assets,
}))

Context.Config.list.push(Schema.object({
  request: satori.Quester.Config,
}))
