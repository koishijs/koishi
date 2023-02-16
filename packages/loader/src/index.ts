import { Logger } from '@koishijs/core'
import { Loader, unwrapExports } from './shared'
import * as dotenv from 'dotenv'
import ns from 'ns-require'

export * from './shared'

const logger = new Logger('app')

// eslint-disable-next-line node/no-deprecated-api
for (const key in require.extensions) {
  Loader.extensions.add(key)
}

export default class NodeLoader extends Loader {
  public scope: ns.Scope

  async init(filename?: string) {
    await super.init(filename)
    this.scope = ns({
      namespace: 'koishi',
      prefix: 'plugin',
      official: 'koishijs',
      dirname: this.baseDir,
    })
  }

  async readConfig() {
    // load .env file into process.env
    dotenv.config({ path: this.envfile })
    return await super.readConfig()
  }

  async resolve(name: string) {
    return this.scope.resolve(name)
  }

  async resolvePlugin(name: string) {
    try {
      this.cache[name] ||= this.scope.resolve(name)
    } catch (err) {
      logger.error(err.message)
      return
    }
    return unwrapExports(require(this.cache[name]))
  }

  fullReload(code = Loader.exitCode) {
    const body = JSON.stringify(this.envData)
    process.send({ type: 'shared', body }, (err: any) => {
      if (err) logger.error('failed to send shared data')
      logger.info('trigger full reload')
      process.exit(code)
    })
  }
}
