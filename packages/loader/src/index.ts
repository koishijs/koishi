import { Dict, Logger } from '@koishijs/core'
import { promises as fs } from 'fs'
import * as dotenv from 'dotenv'
import ns from 'ns-require'
import Loader from './shared'
import { createRequire } from 'module'

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

  migrateEntry(name: string, config: Dict) {
    config ??= {}
    if (['database-mysql', 'database-mongo', 'database-postgres'].includes(name)) {
      config.database ??= 'koishi'
    } else if (name === 'database-sqlite') {
      config.path ??= 'data/koishi.db'
    } else {
      return super.migrateEntry(name, config)
    }
    return config
  }

  async migrate() {
    try {
      let isDirty = false
      const meta = JSON.parse(await fs.readFile('package.json', 'utf8'))
      const require = createRequire(__filename)
      const deps = require('koishi/package.json').dependencies
      function addDep(name: string) {
        meta.dependencies[name] = deps[name]
        isDirty = true
      }

      if (!meta.dependencies['@koishijs/plugin-http']) {
        const { request = {} } = this.config as any
        delete this.config['request']
        this.config.plugins = {
          http: request,
          ...this.config.plugins,
        }
        addDep('@koishijs/plugin-http')
      }

      if (!meta.dependencies['@koishijs/plugin-proxy-agent']) {
        this.config.plugins = {
          'proxy-agent': {},
          ...this.config.plugins,
        }
        addDep('@koishijs/plugin-proxy-agent')
      }

      function getProxyAgent(plugins: Dict) {
        for (const [key, value] of Object.entries(plugins)) {
          const name = key.replace(/^~/, '').split(':')[0]
          let result: any
          if (name === 'http') {
            result = value?.proxyAgent
            delete value.proxyAgent
          } else if (name === 'group') {
            result = getProxyAgent(value)
          }
          if (result) return result
        }
      }

      function setProxyAgent(plugins: Dict) {
        for (const [key, value] of Object.entries(plugins)) {
          const name = key.replace(/^~/, '').split(':')[0]
          if (name === 'proxy-agent') {
            plugins[key] = { ...value, proxyAgent }
            return true
          } else if (name === 'group') {
            const result = setProxyAgent(value)
            if (result) return result
          }
        }
      }

      const proxyAgent = getProxyAgent(this.config.plugins)
      if (proxyAgent) setProxyAgent(this.config.plugins)

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
        addDep('@koishijs/plugin-server')
      }

      if (isDirty) {
        meta.dependencies = Object.fromEntries(Object.entries(meta.dependencies).sort(([a], [b]) => a.localeCompare(b)))
        await fs.writeFile('package.json', JSON.stringify(meta, null, 2) + '\n')
      }
    } catch (error) {
      logger.warn('failed to migrate manifest')
      logger.warn(error)
    }

    await super.migrate()
  }

  async readConfig(initial = false) {
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

    return await super.readConfig(initial)
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
