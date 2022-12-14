import { Random } from '@koishijs/utils'
import { distance } from 'fastest-levenshtein'
import { Dict, isNullable } from 'cosmokit'
import { Context, Logger, segment } from '@satorijs/core'
import zhCN from './locales/zh-CN.yml'
import enUS from './locales/en-US.yml'
import jaJP from './locales/ja-JP.yml'
import frFR from './locales/fr-FR.yml'
import zhTW from './locales/zh-TW.yml'

const logger = new Logger('i18n')
const kTemplate = Symbol('template')

declare module '@satorijs/core' {
  interface Context {
    i18n: I18n
  }

  interface Events {
    'internal/i18n'(): void
  }
}

export interface CompareOptions {
  minSimilarity?: number
}

export namespace I18n {
  export type Node = string | Store

  export interface Store {
    [kTemplate]?: string
    [K: string]: Node
  }

  export type Formatter = (value: any, args: string[], locale: string) => string
  export type Renderer = (dict: Dict, params: any, locale: string) => string

  export interface FindOptions extends CompareOptions {}

  export interface FindResult {
    locale: string
    data: Dict
    similarity: number
  }
}

export class I18n {
  _data: Dict<I18n.Store> = {}
  _presets: Dict<I18n.Renderer> = {}

  constructor(public ctx: Context) {
    this.define('', { '': '' })
    this.define('zh', zhCN)
    this.define('en', enUS)
    this.define('ja', jaJP)
    this.define('fr', frFR)
    this.define('zh-TW', zhTW)
    this.registerBuiltins()
  }

  compare(expect: string, actual: string, options: CompareOptions = {}) {
    const value = 1 - distance(expect, actual) / expect.length
    const threshold = options.minSimilarity ?? this.ctx.root.config.minSimilarity
    return value >= threshold ? value : 0
  }

  private set(locale: string, prefix: string, value: I18n.Node) {
    if (prefix.includes('@') || typeof value === 'string') {
      const dict = this._data[locale]
      const [path, preset] = prefix.slice(0, -1).split('@')
      if (preset) {
        value[kTemplate] = preset
        logger.warn('preset is deprecated and will be removed in the future')
      }
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
    this.ctx.emit('internal/i18n')
  }

  /** @deprecated */
  formatter(name: string, callback: I18n.Formatter) {
    logger.warn('formatter is deprecated and will be removed in the future')
  }

  /** @deprecated */
  preset(name: string, callback: I18n.Renderer) {
    this._presets[name] = callback
  }

  find(path: string, actual: string, options: I18n.FindOptions = {}): I18n.FindResult[] {
    if (!actual) return []
    const groups: string[] = []
    path = path.replace(/\(([^)]+)\)/g, (_, name) => {
      groups.push(name)
      return '([^.]+)'
    })
    const pattern = new RegExp(`^${path}$`)
    const results: I18n.FindResult[] = []
    for (const locale in this._data) {
      for (const path in this._data[locale]) {
        const capture = pattern.exec(path)
        if (!capture) continue
        const expect = this._data[locale][path]
        if (typeof expect !== 'string') continue
        const similarity = this.compare(expect, actual, options)
        if (!similarity) continue
        const data = {}
        for (let i = 0; i < groups.length; i++) {
          data[groups[i]] = capture[i + 1]
        }
        results.push({ locale, data, similarity })
      }
    }
    return results
  }

  render(value: I18n.Node, params: any, locale: string) {
    if (value === undefined) return

    if (typeof value !== 'string') {
      const preset = value[kTemplate]
      const render = this._presets[preset]
      if (!render) throw new Error(`Preset "${preset}" not found`)
      return render(value, params, locale)
    }

    return segment.parse(value, params).join('')
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
