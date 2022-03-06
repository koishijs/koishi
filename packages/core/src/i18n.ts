import { Dict } from '@koishijs/utils'
import { Context } from './context'

type Value = string | Function
type Node = Value | Store

interface Store {
  [K: string]: Node
}

export class Template {
  data: Dict<Dict<Value>> = {}

  constructor(protected ctx: Context) {}

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
        return value
      } else if (typeof value === 'function') {
        return value.apply(null, params)
      }
    }
    return path
  }
}
