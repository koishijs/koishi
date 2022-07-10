import { Context } from '@koishijs/core'
import ns from 'ns-require'

declare module 'cordis' {
  interface Context {
    plugin(path: string, config?: any): Fork<this>
  }
}

declare module '@koishijs/core' {
  interface Context {
    baseDir: string
  }
}

export class Patch {
  constructor(ctx: Context) {
    ctx.app.baseDir ??= process.cwd()
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
