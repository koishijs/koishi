import { accessSync, constants, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, extname, resolve } from 'path'
import { Context, Logger } from '@koishijs/core'
import { Loader, unwrapExports } from './shared'
import * as dotenv from 'dotenv'
import * as yaml from 'js-yaml'
import ns from 'ns-require'

export * from './shared'

const logger = new Logger('app')

const writableExts = ['.json', '.yml', '.yaml']
const supportedExts = ['.js', '.json', '.ts', '.coffee', '.yaml', '.yml']

export default class NodeLoader extends Loader {
  public envData = JSON.parse(process.env.KOISHI_SHARED || '{}')
  public baseDir = process.cwd()
  public extname: string
  public scope: ns.Scope
  public ctxData = {
    env: process.env,
  }

  constructor(filename?: string) {
    super()
    if (filename) {
      filename = resolve(this.baseDir, filename)
      const stats = statSync(filename)
      if (stats.isFile()) {
        this.filename = filename
        this.baseDir = dirname(filename)
        this.extname = extname(filename)
        if (!supportedExts.includes(this.extname)) {
          throw new Error('extension not supported')
        }
      } else {
        this.baseDir = filename
        this.findConfig()
      }
    } else {
      this.findConfig()
    }
    this.writable = this.checkWritable()
    this.envfile = resolve(this.baseDir, '.env')
    this.scope = ns({
      namespace: 'koishi',
      prefix: 'plugin',
      official: 'koishijs',
      dirname: this.baseDir,
    })
  }

  private checkWritable() {
    if (!writableExts.includes(this.extname)) return false
    try {
      accessSync(this.filename, constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  private findConfig() {
    const files = readdirSync(this.baseDir)
    for (const basename of ['koishi.config', 'koishi']) {
      for (const extname of supportedExts) {
        if (files.includes(basename + extname)) {
          this.extname = extname
          this.filename = resolve(this.baseDir, basename + extname)
          return
        }
      }
    }
    throw new Error('config file not found')
  }

  readConfig() {
    // load .env file into process.env
    dotenv.config({ path: this.envfile })

    if (['.yaml', '.yml'].includes(this.extname)) {
      this.config = yaml.load(readFileSync(this.filename, 'utf8')) as any
    } else if (['.json'].includes(this.extname)) {
      // we do not use require here because it will pollute require.cache
      this.config = JSON.parse(readFileSync(this.filename, 'utf8')) as any
    } else {
      const module = require(this.filename)
      this.config = module.default || module
    }

    return new Context.Config(this.interpolate(this.config))
  }

  writeConfig() {
    this.app.emit('config')
    this.suspend = true
    if (!this.writable) throw new Error('cannot overwrite readonly config')
    if (this.extname === '.json') {
      writeFileSync(this.filename, JSON.stringify(this.config, null, 2))
    } else {
      writeFileSync(this.filename, yaml.dump(this.config))
    }
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
