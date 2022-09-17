import { Dict, isNullable, Logger, Random, Time } from '@koishijs/utils'
import { Context } from './context'
import zh from './locales/zh.yml'
import en from './locales/en.yml'
import ja from './locales/ja.yml'
import fr from './locales/fr.yml'
import zhTW from './locales/zh-tw.yml'

const logger = new Logger('i18n')
const kTemplate = Symbol('template')

declare module './context' {
  interface Context {
    i18n: I18n
  }
}

export namespace I18n {
  export type Node = string | Store

  export interface Store {
    [kTemplate]?: string
    [K: string]: Node
  }

  export type Formatter = (value: any, args: string[], locale: string) => string
  export type Renderer = (dict: Dict, params: any, locale: string) => string
}

export class I18n {
  _data: Dict<I18n.Store> = {}
  _formatters: Dict<I18n.Formatter> = {}
  _presets: Dict<I18n.Renderer> = {}

  constructor(ctx: Context) {
    this.define('', { '': '' })
    this.define('zh', zh)
    this.define('en', en)
    this.define('ja', ja)
    this.define('fr', fr)
    this.define('zh-tw', zhTW)
    this.registerBuiltins()
  }

  private set(locale: string, prefix: string, value: I18n.Node) {
    if (prefix.includes('@') || typeof value === 'string') {
      const dict = this._data[locale]
      const [path, preset] = prefix.slice(0, -1).split('@')
      if (preset) value[kTemplate] = preset
      if (!isNullable(dict[path]) && !locale.startsWith('$')) {
        logger.warn('override', locale, path)
      }
      dict[path] = value
      this[Context.current]?.on('dispose', () => {
        delete dict[path]
      })
    } else {
      for (const key in value) {
        this.set(locale, prefix + key + '.', value[key])
      }
    }
  }

  define(locale: string, dict: I18n.Store): void
  define(locale: string, key: string, value: I18n.Node): void
  define(locale: string, ...args: [I18n.Store] | [string, I18n.Node]) {
    this._data[locale] ||= {}
    if (typeof args[0] === 'string') {
      this.set(locale, args[0] + '.', args[1])
    } else {
      this.set(locale, '', args[0])
    }
  }

  formatter(name: string, callback: I18n.Formatter) {
    this._formatters[name] = callback
  }

  preset(name: string, callback: I18n.Renderer) {
    this._presets[name] = callback
  }

  render(value: I18n.Node, params: any, locale: string) {
    if (value === undefined) return

    if (typeof value !== 'string') {
      const preset = value[kTemplate]
      const render = this._presets[preset]
      if (!render) throw new Error(`Preset "${preset}" not found`)
      return render(value, params, locale)
    }

    return value.replace(/\{(.+?)\}/g, (_, inner: string) => {
      const [path, ...exprs] = inner.split('|')
      const segments = path.trim().split('.')
      let result = params
      for (const segment of segments) {
        result = result[segment]
        if (isNullable(result)) return ''
      }
      for (const expr of exprs) {
        const cap = expr.trim().match(/(\w+)(?:\((.+)\))?/)
        const formatter = this._formatters[cap[1]]
        if (!formatter) throw new Error(`Formatter "${cap[1]}" not found`)
        const args = cap[2] ? cap[2].split(',').map(v => v.trim()) : []
        result = formatter(result, args, locale)
      }
      return result.toString()
    })
  }

  text(locales: Iterable<string>, paths: string[], params: object) {
    // sort locales by priority
    const queue = new Set<string>()
    for (const locale of locales) {
      if (!locale) continue
      queue.add(locale)
    }
    for (const locale in this._data) {
      if (locale.startsWith('$')) continue
      queue.add(locale)
    }

    // try every locale
    for (const path of paths) {
      for (const locale of queue) {
        for (const key of ['$' + locale, locale]) {
          const value = this._data[key]?.[path]
          if (value === undefined) continue
          return this.render(value, params, locale)
        }
      }
    }

    // path not found
    logger.warn('missing', paths[0])
    return paths[0]
  }

  private registerBuiltins() {
    const units = ['day', 'hour', 'minute', 'second'] as const

    this.formatter('time', (ms: number, _, locale) => {
      for (let index = 0; index < 3; index++) {
        const major = Time[units[index]]
        const minor = Time[units[index + 1]]
        if (ms >= major - minor / 2) {
          ms += minor / 2
          let result = Math.floor(ms / major) + ' ' + this.text([locale], ['general.' + units[index]], {})
          if (ms % major > minor) {
            result += ` ${Math.floor(ms % major / minor)} ` + this.text([locale], ['general.' + units[index + 1]], {})
          }
          return result
        }
      }
      return Math.round(ms / Time.second) + ' ' + this.text([locale], ['general.second'], {})
    })

    this.preset('plural', (data: string[], params: { length: number }, locale) => {
      const path = params.length in data ? params.length : data.length - 1
      return this.render(data[path], params, locale)
    })

    this.preset('random', (data: string[], params, locale) => {
      return this.render(Random.pick(data), params, locale)
    })

    this.preset('list', (data, params: any[], locale) => {
      const list = Object.entries(params).map(([key, value]) => {
        return this.render(data.item, { key, value }, locale)
      })
      list.unshift(this.render(data.header, params, locale))
      list.push(this.render(data.footer, params, locale))
      return list.join('\n').trim()
    })
  }
}

Context.service('i18n', I18n)
