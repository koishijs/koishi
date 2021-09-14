import { resolve, extname, dirname, isAbsolute } from 'path'
import { yellow } from 'kleur'
import { readdirSync, readFileSync } from 'fs'
import { App, Context, hyphenate, makeArray, Module } from 'koishi'

const oldPaths = Module.internal.paths
Module.internal.paths = function (name: string) {
  // resolve absolute or relative path
  if (isAbsolute(name) || name.startsWith('.')) {
    return [resolve(configDir, name)]
  }
  return oldPaths(name)
}

let configDir = process.cwd()

export class Loader {
  configDir: string
  configFile: string
  configExt: string
  children = new Set<string>()

  constructor() {
    const basename = 'koishi.config'
    if (process.env.KOISHI_CONFIG_FILE) {
      this.configFile = resolve(configDir, process.env.KOISHI_CONFIG_FILE)
      this.configExt = extname(this.configFile)
      this.configDir = configDir = dirname(this.configFile)
    } else {
      const files = readdirSync(configDir)
      this.configExt = ['.js', '.json', '.ts', '.coffee', '.yaml', '.yml'].find(ext => files.includes(basename + ext))
      if (!this.configExt) {
        throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
      }
      this.configDir = configDir
      this.configFile = configDir + '/' + basename + this.configExt
    }
  }

  loadConfig() {
    if (['.yaml', '.yml'].includes(this.configExt)) {
      const { load } = require('js-yaml') as typeof import('js-yaml')
      return load(readFileSync(this.configFile, 'utf8')) as any
    } else {
      const exports = require(this.configFile)
      return exports.__esModule ? exports.default : exports
    }
  }

  loadPlugins(app: App) {
    const config = app.options.plugins ||= {}
    for (const name in config) {
      const options = config[name] ?? undefined
      const path = Module.resolve(hyphenate(name))
      this.children.add(path)
      createContext(app, options).plugin(require(path), options)
    }
  }
}

const selectors = ['user', 'guild', 'channel', 'self', 'private', 'platform'] as const

type SelectorType = typeof selectors[number]
type SelectorValue = boolean | string | number | (string | number)[]
type BaseSelection = { [K in SelectorType as `$${K}`]?: SelectorValue }

interface Selection extends BaseSelection {
  $union?: Selection[]
  $except?: Selection
}

function createContext(app: App, options: Selection) {
  let ctx: Context = app

  // basic selectors
  for (const type of selectors) {
    const value = options[`$${type}`] as SelectorValue
    if (value === true) {
      ctx = ctx[type]()
    } else if (value === false) {
      ctx = ctx[type].except()
    } else if (value !== undefined) {
      // we turn everything into string
      ctx = ctx[type](...makeArray(value).map(item => '' + item))
    }
  }

  // union
  if (options.$union) {
    let ctx2: Context = app
    for (const selection of options.$union) {
      ctx2 = ctx2.union(createContext(app, selection))
    }
    ctx = ctx.intersect(ctx2)
  }

  // except
  if (options.$except) {
    ctx = ctx.except(createContext(app, options.$except))
  }

  return ctx
}
