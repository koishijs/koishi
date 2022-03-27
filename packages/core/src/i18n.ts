import { Dict, isNullable, Logger } from '@koishijs/utils'
import { Context } from './context'

const logger = new Logger('i18n')

export namespace I18n {
  export type Template = string | { $: string }
  export type Node = Template | Store

  export interface Store {
    [K: string]: Node
  }

  export type Formatter = (value: string, ...args: string[]) => string
  export type Renderer = (dict: Dict, params: any, locale: string) => string
}

export class I18n {
  _data: Dict<Dict<I18n.Template>> = {}
  _formatters: Dict<I18n.Formatter> = {}
  _renderers: Dict<I18n.Renderer> = {}

  static isTemplate(data: any): data is I18n.Template {
    return typeof data === 'string' || data?.$
  }

  constructor(protected ctx: Context) {
    this.define('', { '': '' })
    this.define('zh', require('./locales/zh'))
    this.define('en', require('./locales/en'))

    this.renderer('list', (data, params: any[], locale) => {
      const list = params.map((value) => {
        return this.render(data.item, { value }, locale)
      })
      if (data.header) list.unshift(this.render(data.header, params, locale))
      if (data.footer) list.push(this.render(data.footer, params, locale))
      return list.join('\n')
    })

    this.renderer('inline-list', (data, params: any[], locale) => {
      let output = ''
      params.forEach((value, index) => {
        if (index) {
          if (index === params.length - 1 && data.conj !== undefined) {
            output += data.conj
          } else {
            output += data.separator ?? this.text([locale], ['general.comma'], {})
          }
        }
        output += this.render(data.item, { value }, locale) ?? value
      })
      const path = params.length in data ? params.length : 'body'
      if (data[path] === undefined) return output
      return this.render(data[path], [output, params.length], locale)
    })
  }

  private set(locale: string, prefix: string, value: I18n.Node) {
    if (I18n.isTemplate(value)) {
      const dict = this._data[locale]
      const path = prefix.slice(0, -1)
      if (!isNullable(dict[path]) && !locale.startsWith('$')) {
        logger.warn('override', locale, path)
      }
      dict[path] = value as I18n.Template
      this[Context.current]?.on('dispose', () => {
        delete dict[path]
      })
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

  formatter(name: string, callback: I18n.Formatter) {
    this._formatters[name] = callback
  }

  renderer(name: string, callback: I18n.Renderer) {
    this._renderers[name] = callback
  }

  render(value: I18n.Template, params: any, locale: string) {
    if (value === undefined) return

    if (typeof value !== 'string') {
      const render = this._renderers[value.$]
      if (!render) throw new Error(`Renderer "${value.$}" not found`)
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
        result = formatter(result, ...args)
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
}
