import { resolve, extname, dirname, isAbsolute } from 'path'
import { yellow } from 'kleur'
import { readdirSync, readFileSync } from 'fs'
import { App, Context, Dict, hyphenate, makeArray, Module, Plugin } from 'koishi'
import { load } from 'js-yaml'

const oldPaths = Module.internal.paths
Module.internal.paths = function (name: string) {
  // resolve absolute or relative path
  if (isAbsolute(name) || name.startsWith('.')) {
    return [resolve(cwd, name)]
  }
  return oldPaths(name)
}

let cwd = process.cwd()

export class Loader {
  dirname: string
  filename: string
  extname: string
  app: App
  cache: Dict<Plugin> = {}

  constructor() {
    const basename = 'koishi.config'
    if (process.env.KOISHI_CONFIG_FILE) {
      this.filename = resolve(cwd, process.env.KOISHI_CONFIG_FILE)
      this.extname = extname(this.filename)
      this.dirname = cwd = dirname(this.filename)
    } else {
      const files = readdirSync(cwd)
      this.extname = ['.js', '.json', '.ts', '.coffee', '.yaml', '.yml'].find(ext => files.includes(basename + ext))
      if (!this.extname) {
        throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
      }
      this.dirname = cwd
      this.filename = cwd + '/' + basename + this.extname
    }
  }

  loadConfig() {
    if (['.yaml', '.yml'].includes(this.extname)) {
      return load(readFileSync(this.filename, 'utf8')) as any
    } else {
      const exports = require(this.filename)
      return exports.__esModule ? exports.default : exports
    }
  }

  loadPlugin(name: string, options: any) {
    const path = Module.resolve(hyphenate(name))
    const plugin = this.cache[name] = require(path)
    createContext(this.app, options).plugin(plugin, options)
    return plugin
  }

  createApp(config: App.Config) {
    const app = this.app = new App(config)
    const plugins = app.options.plugins ||= {}
    for (const name in plugins) {
      this.loadPlugin(name, plugins[name] ?? undefined)
    }
    return app
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
