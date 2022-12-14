import { Context } from '@koishijs/core'
import ns from 'ns-require'

export { Router, WebSocketLayer } from '@satorijs/satori'

export * from '@koishijs/core'
export * from '@koishijs/utils'

declare module 'cordis' {
  interface Context {
    plugin(path: string, config?: any): ForkScope<this>
  }
}

declare module '@satorijs/core' {
  interface Context {
    shared: SharedData
    baseDir: string
  }
}

export interface SharedData {}

export class Patch {
  constructor(ctx: Context) {
    ctx.root.shared ??= {}
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
