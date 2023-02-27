// This file is only intended for users who do not use CLI.

import { Context } from '@koishijs/core'
import ns from 'ns-require'

export { Router, WebSocketLayer } from '@satorijs/satori'

export type { Watcher } from './worker'
export * from '@koishijs/core'
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

export const scope = ns({
  namespace: 'koishi',
  prefix: 'plugin',
  official: 'koishijs',
})

const plugin = Context.prototype.plugin
Context.prototype.plugin = function (this: Context, entry: any, config?: any) {
  if (typeof entry === 'string') {
    entry = scope.require(entry)
  }
  return plugin.call(this, entry, config)
}
