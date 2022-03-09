import { Dict, isNullable } from '@koishijs/utils'
import { Context } from './context'

type Value = string
type Node = Value | Store

interface Store {
  [K: string]: Node
}

export class Template {
  data: Dict<Dict<Value>> = {}

  constructor(protected ctx: Context) {
    this.define('', {})
    this.define('zh', require('./locales/zh'))
    this.define('en', require('./locales/en'))
  }

  private set(locale: string, prefix: string, value: Node) {
    if (typeof value === 'string') {
      this.data[locale][prefix.slice(0, -1)] = value
    } else if (value) {
      for (const key in value) {
        this.set(locale, prefix + key + '.', value[key])
      }
    }
  }

  define(locale: string, dict: Store): void
  define(locale: string, key: string, value: Node): void
  define(locale: string, ...args: [Store] | [string, Node]) {
    this.data[locale] ||= {}
    if (typeof args[0] === 'string') {
      this.set(locale, args[0] + '.', args[1])
    } else {
      this.set(locale, '', args[0])
    }
  }

  render(locales: Iterable<string>, path: string, params: object) {
    // optional path
    let optional = false
    if (path.endsWith('?')) {
      optional = true
      path = path.slice(0, -1)
    }

    // sort locales by priority
    const queue = new Set<string>()
    for (const locale of locales) {
      if (!locale) continue
      queue.add(locale)
    }
    for (const locale in this.data) {
      if (locale.startsWith('$')) continue
      queue.add(locale)
    }

    // try every locale
    for (const locale of queue) {
      for (const key of ['$' + locale, locale]) {
        const value = this.data[key]?.[path]
        if (typeof value !== 'string') continue

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
    }

    // path not found
    if (optional) return ''
    this.ctx.logger('i18n').warn('missing', path)
    return path
  }
}
