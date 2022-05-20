import { App, Context } from '@koishijs/core'
import { trimSlash } from '@koishijs/utils'
import ns from 'ns-require'

declare module '@koishijs/core' {
  interface App {
    baseDir: string
  }

  namespace Registry {
    interface Delegates {
      plugin(path: string, config?: any): Context
    }
  }
}

export class Patch {
  constructor(ctx: Context) {
    ctx.app.baseDir ??= process.cwd()
  }
}

Context.service(Symbol('patch'), {
  constructor: Patch,
})

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

const start = App.prototype.start
App.prototype.start = async function (this: App, ...args) {
  const { host, port, selfUrl } = this.options
  if (selfUrl) this.options.selfUrl = trimSlash(selfUrl)
  if (port) {
    await new Promise<void>(resolve => this._httpServer.listen(port, host, resolve))
    this.logger('app').info('server listening at %c', `http://${host}:${port}`)
    this.on('dispose', () => {
      this.logger('app').info('http server closing')
      this._wsServer?.close()
      this._httpServer?.close()
    })
  }
  return start.call(this, ...args)
}
