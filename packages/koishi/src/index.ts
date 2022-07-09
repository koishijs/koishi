import { Context, Schema } from '@koishijs/core'
import { Cache } from './cache'
import { Assets } from './assets'

export { Quester, Router } from '@satorijs/env-node'
export * from './assets'
export * from './cache'
export * from './patch'

export * from '@koishijs/core'
export * from '@koishijs/utils'

declare module '@koishijs/core' {
  interface Context {
    assets: Assets
    cache: Cache
  }
}

Context.Config.list.push(Schema.object({
  assets: Context.Config.Assets,
}))

Context.service('assets')
Context.service('cache')
