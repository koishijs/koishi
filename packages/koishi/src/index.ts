// This file is only intended for users who do not use CLI.

import { Context } from '@koishijs/core'

export { Router, WebSocketLayer } from '@satorijs/satori'

export * from '@koishijs/core'
export * from '@koishijs/loader'
export * from '@koishijs/utils'

declare module 'cordis' {
  interface Context {
    plugin(path: string, config?: any): ForkScope<this>
  }
}

class Patch {
  constructor(ctx: Context) {
    // patch for @koishijs/loader
    ctx.root.envData ??= {}
    ctx.root.baseDir ??= process.cwd()
  }
}

Context.service('$patch', Patch)
