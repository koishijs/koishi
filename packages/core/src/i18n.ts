import { Dict, isNullable, Logger } from '@koishijs/utils'
import { Context } from './context'

const logger = new Logger('i18n')

export namespace I18n {
  export type Template = string | { $: string }
  export type Node = Template | Store

  export interface Store {
    [K: string]: Node
  }

  export type Renderer = (dict: Context, params: any, locale: string) => string

  export interface Context {
    $(path: string, params?: object): string
    [key: string]: any
  }
}

export class I18n {
  _data: Dict<Dict<I18n.Template>> = {}
  _renderers: Dict<I18n.Renderer> = {}

  static isTemplate(data: any): data is I18n.Template {
    return typeof data === 'string' || data?.$
  }

  constructor(protected ctx: Context) {
    this.define('', { '': '' })
    this.define('zh', require('./locales/zh'))
    this.define('en', require('./locales/en'))

    this.renderer('list', (data, params: any[]) => {
      const body = params.map(item => data.$('item', item)).join(data.$('separator'))
      if (data[params.length]) {
        return data.$('' + params.length, [params.length, body])
      } else {
        return data.$('default', [params.length, body])
      }
    })
  }

  private set(locale: string, prefix: string, value: I18n.Node) {
    if (I18n.isTemplate(value)) {
      const dict = this._data[locale]
      const path = prefix.slice(0, -1)
      if (dict[path] && !locale.startsWith('$')) {
        logger.warn('override', locale, path)
      }
      dict[path] = value as I18n.Template
    } else if (value) {
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

  renderer(name: string, callback: I18n.Renderer) {
    this._renderers[name] = callback
  }

  render(value: I18n.Template, params: object, locale: string) {
    if (typeof value !== 'string') {
      const render = this._renderers[value.$]
      if (!render) throw new Error(`Renderer "${value.$}" not found`)
      const context = Object.create(value)
      context.$ = (path: string, params: any) => {
        return this.render(value[path], params, locale)
      }
      return render(context, params, locale)
    }

    return value.replace(/\{([\w-.]+)\}/g, (_, path) => {
      const segments = path.split('.')
      let result = params
      for (const segment of segments) {
        result = result[segment]
        if (isNullable(result)) return ''
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
    for (const locale of queue) {
      for (const key of ['$' + locale, locale]) {
        for (const path of paths) {
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
}
