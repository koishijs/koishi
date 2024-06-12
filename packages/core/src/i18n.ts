import { distance } from 'fastest-levenshtein'
import { Dict, isNullable } from 'cosmokit'
import { fallback, LocaleTree } from '@koishijs/i18n-utils'
import { h, Logger, Schema } from '@satorijs/core'
import { Context } from './context'
import zhCN from './locales/zh-CN.yml'
import enUS from './locales/en-US.yml'

const logger = new Logger('i18n')
const kTemplate = Symbol('template')

declare module './context' {
  interface Context {
    i18n: I18n
  }

  interface Events {
    'internal/i18n'(): void
  }
}

type GroupNames<P extends string, K extends string = never> =
  | P extends `${string}(${infer R})${infer S}`
  ? GroupNames<S, K | R>
  : K

export type MatchResult<P extends string = never> = Record<GroupNames<P>, string>

export function createMatch<P extends string>(pattern: P): (string: string) => undefined | MatchResult<P> {
  const groups: string[] = []
  const source = pattern.replace(/\(([^)]+)\)/g, (_, name) => {
    groups.push(name)
    return '(.+)'
  })
  const regexp = new RegExp(`^${source}$`)
  return (string: string) => {
    const capture = regexp.exec(string)
    if (!capture) return
    const data: any = {}
    for (let i = 0; i < groups.length; i++) {
      data[groups[i]] = capture[i + 1]
    }
    return data
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

  export interface FindResult<P extends string> {
    locale: string
    data: MatchResult<P>
    similarity: number
  }
}

export class I18n {
  _data: Dict<Dict<string>> = {}
  _presets: Dict<I18n.Renderer> = {}

  locales: LocaleTree

  constructor(public ctx: Context, config: I18n.Config) {
    this.locales = LocaleTree.from(config.locales)

    this.define('', { '': '' })
    this.define('zh-CN', zhCN)
    this.define('en-US', enUS)
  }

  fallback(locales: string[]) {
    return fallback(this.locales, locales)
  }

  compare(expect: string, actual: string, options: CompareOptions = {}) {
    const value = 1 - distance(expect, actual) / expect.length
    const threshold = options.minSimilarity ?? this.ctx.root.config.minSimilarity
    return value >= threshold ? value : 0
  }

  get(key: string, locales: string[] = []): Dict<string> {
    const result: Dict<string> = {}
    for (const locale of this.fallback(locales)) {
      const value = this._data[locale]?.[key]
      if (value) result[locale] = value
    }
    return result
  }

  private* set(locale: string, prefix: string, value: I18n.Node): Generator<string> {
    if (typeof value === 'object' && value && !prefix.includes('@')) {
      for (const key in value) {
        if (key.startsWith('_')) continue
        yield* this.set(locale, prefix + key + '.', value[key])
      }
    } else if (prefix.includes('@')) {
      throw new Error('preset is deprecated')
    } else if (typeof value === 'string') {
      const dict = this._data[locale]
      const path = prefix.slice(0, -1)
      if (!isNullable(dict[path]) && !locale.startsWith('$') && dict[path] !== value) {
        logger.warn('override', locale, path)
      }
      dict[path] = value
      yield path
    } else {
      delete this._data[locale][prefix.slice(0, -1)]
    }
  }

  define(locale: string, dict: I18n.Store): () => void
  define(locale: string, key: string, value: I18n.Node): () => void
  define(locale: string, ...args: [I18n.Store] | [string, I18n.Node]) {
    const dict = this._data[locale] ||= {}
    const paths = [...typeof args[0] === 'string'
      ? this.set(locale, args[0] + '.', args[1])
      : this.set(locale, '', args[0])]
    this.ctx.emit('internal/i18n')
    return this.ctx.collect('i18n', () => {
      for (const path of paths) {
        delete dict[path]
      }
      this.ctx.emit('internal/i18n')
    })
  }

  find<P extends string>(pattern: P, actual: string, options: I18n.FindOptions = {}): I18n.FindResult<P>[] {
    if (!actual) return []
    const match = createMatch(pattern)
    const results: I18n.FindResult<P>[] = []
    for (const locale in this._data) {
      for (const path in this._data[locale]) {
        const data = match(path)
        if (!data) continue
        const expect = this._data[locale][path]
        if (typeof expect !== 'string') continue
        const similarity = this.compare(expect, actual, options)
        if (!similarity) continue
        results.push({ locale, data, similarity })
      }
    }
    return results
  }

  _render(value: I18n.Node, params: any, locale: string) {
    if (value === undefined) return

    if (typeof value !== 'string') {
      const preset = value[kTemplate]
      const render = this._presets[preset]
      if (!render) throw new Error(`Preset "${preset}" not found`)
      return [h.text(render(value, params, locale))]
    }

    return h.parse(value, params)
  }

  /** @deprecated */
  text(locales: string[], paths: string[], params: object) {
    return this.render(locales, paths, params).join('')
  }

  render(locales: string[], paths: string[], params: object) {
    locales = this.fallback(locales)

    // try every locale
    for (const path of paths) {
      for (const locale of locales) {
        for (const key of ['$' + locale, locale]) {
          const value = this._data[key]?.[path]
          if (value === undefined || !value && !locale && path !== '') continue
          return this._render(value, params, locale)
        }
      }
    }

    // path not found
    logger.warn('missing', paths[0])
    return [h.text(paths[0])]
  }
}

export namespace I18n {
  export interface Config {
    locales?: string[]
    output?: 'prefer-user' | 'prefer-channel'
    match?: 'strict' | 'prefer-input' | 'prefer-output'
  }

  export const Config: Schema<Config> = Schema.object({
    locales: Schema.array(String).role('table').default(['zh-CN', 'en-US', 'fr-FR', 'ja-JP', 'de-DE', 'ru-RU']).description('可用的语言列表。按照回退顺序排列。'),
    output: Schema.union([
      Schema.const('prefer-user').description('优先使用用户语言'),
      Schema.const('prefer-channel').description('优先使用频道语言'),
    ]).default('prefer-channel').description('输出语言偏好设置。'),
  }).description('国际化设置')
}
