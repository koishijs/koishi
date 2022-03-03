import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, extname, resolve } from 'path'
import yaml from 'js-yaml'

const writableExts = ['.json', '.yml', '.yaml']
const supportedExts = ['.js', '.json', '.ts', '.coffee', '.yaml', '.yml']

export default class ConfigLoader<T> {
  dirname = process.cwd()
  filename: string
  extname: string
  config: T
  writable: boolean

  constructor(filename?: string) {
    if (filename) {
      filename = resolve(this.dirname, filename)
      const stats = statSync(filename)
      if (stats.isFile()) {
        this.filename = filename
        this.dirname = dirname(filename)
        this.extname = extname(filename)
        if (!supportedExts.includes(this.extname)) {
          throw new Error('extension not supported')
        }
      } else {
        this.dirname = filename
        this.findConfigFile()
      }
    } else {
      this.findConfigFile()
    }
    this.writable = writableExts.includes(this.extname)
  }

  private findConfigFile() {
    const files = readdirSync(this.dirname)
    for (const basename of ['koishi.config', 'koishi']) {
      for (const extname of supportedExts) {
        if (files.includes(basename + extname)) {
          this.extname = extname
          this.filename = this.dirname + '/' + basename + extname
          return
        }
      }
    }
    throw new Error('config file not found')
  }

  loadConfig() {
    if (['.yaml', '.yml'].includes(this.extname)) {
      this.config = yaml.load(readFileSync(this.filename, 'utf8')) as any
    } else if (['.json'].includes(this.extname)) {
      // we do not use require here because it will pollute require.cache
      this.config = JSON.parse(readFileSync(this.filename, 'utf8')) as any
    } else {
      const module = require(this.filename)
      this.config = module.default || module
    }
  }

  writeConfig() {
    if (!this.writable) throw new Error('cannot overwrite readonly config')
    if (this.extname === '.json') {
      writeFileSync(this.filename, JSON.stringify(this.config, null, 2))
    } else {
      writeFileSync(this.filename, yaml.dump(this.config))
    }
  }
}
