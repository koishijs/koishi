// This file is only intended for users who do not use CLI.

import { Context, defineProperty, Schema } from '@koishijs/core'
import { Router, WebSocketLayer } from '@satorijs/router'
import Loader from '@koishijs/loader'

import '@satorijs/satori'

export { Loader, Router, WebSocketLayer }

export * from '@koishijs/core'
export * from '@koishijs/loader'
export * from '@koishijs/utils'

class Patch {
  constructor(ctx: Context) {
    // patch for @koishijs/loader
    ctx.root.envData ??= {}
    ctx.root.baseDir ??= process.cwd()
  }
}

Context.service('$patch', Patch)
Context.service('router', Router)

declare module '@koishijs/core' {
  namespace Context {
    interface Config extends Config.Network {}

    namespace Config {
      interface Network {
        host?: string
        port?: number
        maxPort?: number
        selfUrl?: string
      }

      interface Static extends Schema<Config> {
        Network: Schema<Network>
      }
    }
  }
}

defineProperty(Context.Config, 'Network', Router.Config.description('网络设置'))

Context.Config.list.unshift(Context.Config.Network)
