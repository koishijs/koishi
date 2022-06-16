import { App, Context } from '@koishijs/core'
import { trimSlash } from '@koishijs/utils'
import { getPortPromise } from 'portfinder'
import ns from 'ns-require'

declare module '@koishijs/core' {
  interface App {
    baseDir: string
  }

  namespace Registry {
    interface Delegates {
      plugin(path: string, config?: any): Fork
    }
  }
}

export class Patch {
  constructor(ctx: Context) {
    ctx.app.baseDir ??= process.cwd()
  }
}

Context.service('$patch', {
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
  if (this.options.selfUrl) {
    this.options.selfUrl = trimSlash(this.options.selfUrl)
  }

  if (this.options.port) {
    this.options.port = await getPortPromise({
      port: this.options.port,
      stopPort: this.options.maxPort || this.options.port,
    })
    const { host, port } = this.options
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
