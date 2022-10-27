import { Context, Schema } from '@koishijs/core'
import { Assets } from './assets'

export { Router, WebSocketLayer } from '@satorijs/satori'

export * from './assets'
export * from './patch'

export * from '@koishijs/core'
export * from '@koishijs/utils'

declare module '@satorijs/core' {
  interface Context {
    assets: Assets
    cache: Cache
  }
}

Context.Config.list.push(Schema.object({
  assets: Context.Config.Assets,
}))
