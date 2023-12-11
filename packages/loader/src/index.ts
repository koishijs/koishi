import { Logger } from '@koishijs/core'
import { Loader } from './shared'
import { promises as fs } from 'fs'
import * as dotenv from 'dotenv'
import ns from 'ns-require'

export * from './shared'

const logger = new Logger('app')

// eslint-disable-next-line n/no-deprecated-api
for (const key in require.extensions) {
  Loader.extensions.add(key)
}

const initialKeys = Object.getOwnPropertyNames(process.env)

export default class NodeLoader extends Loader {
  public scope: ns.Scope
  public localKeys: string[] = []

  async init(filename?: string) {
    await super.init(filename)
    this.scope = ns({
      namespace: 'koishi',
      prefix: 'plugin',
      official: 'koishijs',
      dirname: this.baseDir,
    })
  }

  async migrate() {
    if (this.config['port']) {
      const { port, host, maxPort, selfUrl } = this.config as any
      delete this.config['port']
      delete this.config['host']
      delete this.config['maxPort']
      delete this.config['selfUrl']
      this.config.plugins = {
        server: { port, host, maxPort, selfUrl },
        ...this.config.plugins,
      }
      try {
        const version = require('koishi/package.json').dependencies['@koishijs/plugin-server']
        const data = JSON.parse(await fs.readFile('package.json', 'utf8'))
        data.dependencies['@koishijs/plugin-server'] = version
        data.dependencies = Object.fromEntries(Object.entries(data.dependencies).sort(([a], [b]) => a.localeCompare(b)))
        await fs.writeFile('package.json', JSON.stringify(data, null, 2) + '\n')
      } catch {
        logger.warn('please install @koishijs/plugin-server manually')
      }
    }
    await super.migrate()
  }

  async readConfig() {
    // remove local env variables
    for (const key of this.localKeys) {
      delete process.env[key]
    }

    // load env files
    const parsed = {}
    for (const filename of this.envFiles) {
      try {
        const raw = await fs.readFile(filename, 'utf8')
        Object.assign(parsed, dotenv.parse(raw))
      } catch {}
    }

    // write local env into process.env
    this.localKeys = []
    for (const key in parsed) {
      if (initialKeys.includes(key)) continue
      process.env[key] = parsed[key]
      this.localKeys.push(key)
    }

    return await super.readConfig()
  }

  async import(name: string) {
    try {
      this.cache[name] ||= this.scope.resolve(name)
    } catch (err) {
      logger.error(err.message)
      return
    }
    return require(this.cache[name])
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
