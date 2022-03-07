import { Dict } from '@koishijs/utils'
import { Context } from './context'

type Value = string | ((params: object) => string)
type Node = Value | Store

interface Store {
  [K: string]: Node
}

export class Template {
  data: Dict<Dict<Value>> = {}

  constructor(protected ctx: Context) {
    this.define('general', {
      zh: {
        'name': '中文',
        'left-paren': '（',
        'right-paren': '）',
        'left-quote': '“',
        'right-quote': '”',
        'comma': '，',
        'and': '和',
        'or': '或',
      },
      en: {
        'name': 'English',
        'left-paren': ' (',
        'right-paren': ') ',
        'left-quote': '"',
        'right-quote': '"',
        'comma': ', ',
        'and': 'and',
        'or': 'or',
      },
    })
  }

  private set(locale: string, prefix: string, value: Node) {
    if (typeof value === 'string') {
      this.data[locale][prefix] = value
    } else {
      for (const key in value) {
        this.set(locale, `${prefix}.${key}`, value[key])
      }
    }
  }

  define(prefix: string, dict: Store) {
    for (const locale in dict) {
      this.data[locale] ||= {}
      this.set(locale, prefix, dict[locale])
    }
  }

  render(locales: string[], path: string, params: object) {
    for (const locale of locales) {
      const value = this.data[locale]?.[path]
      if (typeof value === 'string') {
        return value.replace(/\{([\w-.]+)\}/g, (_, path) => {
          const segments = path.split('.')
          let result = params
          for (const segment of segments) {
            result = result[segment]
            if (!result) return ''
          }
          return result.toString()
        })
      } else if (typeof value === 'function') {
        return value(params)
      }
    }
    return path
  }
}
