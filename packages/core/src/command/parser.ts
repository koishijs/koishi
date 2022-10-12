import { camelCase, Dict, escapeRegExp, paramCase, Time } from '@koishijs/utils'
import { segment } from '@satorijs/core'
import { Command } from './command'
import { Context } from '../context'
import { Channel, User } from '../database'
import { Session } from '../session'
import { Next } from '../internal'

export interface Token {
  rest?: string
  content: string
  quoted: boolean
  terminator: string
  inters: Argv[]
}

export interface Argv<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O = {}> {
  args?: A
  options?: O
  error?: string
  source?: string
  initiator?: string
  terminator?: string
  session?: Session<U, G>
  command?: Command<U, G, A, O>
  rest?: string
  pos?: number
  root?: boolean
  tokens?: Token[]
  name?: string
  next?: Next
}

const leftQuotes = `"'“‘`
const rightQuotes = `"'”’`

export namespace Argv {
  export interface Interpolation {
    terminator?: string
    parse?(source: string): Argv
  }

  const bracs: Dict<Interpolation> = {}

  export function interpolate(initiator: string, terminator: string, parse?: (source: string) => Argv) {
    bracs[initiator] = { terminator, parse }
  }

  interpolate('$(', ')')

  export namespace whitespace {
    export const unescape = (source: string) => source
      .replace(/@__KOISHI_SPACE__@/g, ' ')
      .replace(/@__KOISHI_NOLINE__@/g, '\n')
      .replace(/@__KOISHI_RETURN__@/g, '\r')
      .replace(/@__KOISHI_TAB__@/g, '\t')

    export const escape = (source: string) => source
      .replace(/ /g, '@__KOISHI_SPACE__@')
      .replace(/\n/g, '@__KOISHI_NOLINE__@')
      .replace(/\r/g, '@__KOISHI_RETURN__@')
      .replace(/\t/g, '@__KOISHI_TAB__@')
  }

  export class Tokenizer {
    private bracs: Dict<Interpolation>

    constructor() {
      this.bracs = Object.create(bracs)
    }

    interpolate(initiator: string, terminator: string, parse?: (source: string) => Argv) {
      this.bracs[initiator] = { terminator, parse }
    }

    parseToken(source: string, stopReg = '$'): Token {
      const parent = { inters: [] } as Token
      const index = leftQuotes.indexOf(source[0])
      const quote = rightQuotes[index]
      let content = ''
      if (quote) {
        source = source.slice(1)
        stopReg = `${quote}(?=${stopReg})|$`
      }
      stopReg += `|${Object.keys({ ...this.bracs, ...bracs }).map(escapeRegExp).join('|')}`
      const regExp = new RegExp(stopReg)
      while (true) {
        const capture = regExp.exec(source)
        content += whitespace.unescape(source.slice(0, capture.index))
        if (capture[0] in this.bracs) {
          source = source.slice(capture.index + capture[0].length).trimStart()
          const { parse, terminator } = this.bracs[capture[0]]
          const argv = parse?.(source) || this.parse(source, terminator)
          source = argv.rest
          parent.inters.push({ ...argv, pos: content.length, initiator: capture[0] })
        } else {
          const quoted = capture[0] === quote
          const rest = source.slice(capture.index + +quoted)
          parent.rest = rest.trimStart()
          parent.quoted = quoted
          parent.terminator = capture[0]
          if (quoted) {
            parent.terminator += rest.slice(0, -parent.rest.length)
          } else if (quote) {
            content = leftQuotes[index] + content
            parent.inters.forEach(inter => inter.pos += 1)
          }
          parent.content = content
          if (quote === "'") Argv.revert(parent)
          return parent
        }
      }
    }

    parse(source: string, terminator = ''): Argv {
      const tokens: Token[] = []
      source = segment.parse(source).map((el) => {
        return el.type === 'text' ? el.toString() : whitespace.escape(el.toString())
      }).join('')
      let rest = source, term = ''
      const stopReg = `\\s+|[${escapeRegExp(terminator)}]|$`
      // eslint-disable-next-line no-unmodified-loop-condition
      while (rest && !(terminator && rest.startsWith(terminator))) {
        const token = this.parseToken(rest, stopReg)
        tokens.push(token)
        rest = token.rest
        term = token.terminator
        delete token.rest
      }
      if (rest.startsWith(terminator)) rest = rest.slice(1)
      source = source.slice(0, -(rest + term).length)
      rest = whitespace.unescape(rest)
      source = whitespace.unescape(source)
      return { tokens, rest, source }
    }

    stringify(argv: Argv) {
      const output = argv.tokens.reduce((prev, token) => {
        if (token.quoted) prev += leftQuotes[rightQuotes.indexOf(token.terminator[0])] || ''
        return prev + token.content + token.terminator
      }, '')
      if (argv.rest && !rightQuotes.includes(output[output.length - 1]) || argv.initiator) {
        return output.slice(0, -1)
      }
      return output
    }
  }

  const defaultTokenizer = new Tokenizer()

  export function parse(source: string, terminator = '') {
    return defaultTokenizer.parse(source, terminator)
  }

  export function stringify(argv: Argv) {
    return defaultTokenizer.stringify(argv)
  }

  export function revert(token: Token) {
    while (token.inters.length) {
      const { pos, source, initiator } = token.inters.pop()
      token.content = token.content.slice(0, pos)
        + initiator + source + bracs[initiator].terminator
        + token.content.slice(pos)
    }
  }

  // builtin domains
  export interface Domain {
    string: string
    number: number
    boolean: boolean
    text: string
    rawtext: string
    user: string
    channel: string
    integer: number
    posint: number
    natural: number
    date: Date
  }

  type DomainType = keyof Domain

  type ParamType<S extends string, F>
    = S extends `${any}:${infer T}` ? T extends DomainType ? Domain[T] : F : F

  type Replace<S extends string, X extends string, Y extends string>
    = S extends `${infer L}${X}${infer R}` ? `${L}${Y}${Replace<R, X, Y>}` : S

  type ExtractAll<S extends string, F>
    = S extends `${infer L}]${infer R}` ? [ParamType<L, F>, ...ExtractAll<R, F>] : []

  type ExtractFirst<S extends string, F>
    = S extends `${infer L}]${any}` ? ParamType<L, F> : boolean

  type ExtractSpread<S extends string> = S extends `${infer L}...${infer R}`
    ? [...ExtractAll<L, string>, ...ExtractFirst<R, string>[]]
    : [...ExtractAll<S, string>, ...string[]]

  export type ArgumentType<S extends string> = ExtractSpread<Replace<S, '>', ']'>>

  export type OptionType<S extends string> = ExtractFirst<Replace<S, '>', ']'>, any>

  export type Type = DomainType | RegExp | readonly string[] | Transform<any>

  export interface Declaration {
    name?: string
    type?: Type
    fallback?: any
    variadic?: boolean
    required?: boolean
  }

  export type Transform<T> = (source: string, session: Session) => T

  export interface DomainConfig<T> {
    transform?: Transform<T>
    greedy?: boolean
  }

  function resolveConfig(type: Type) {
    return typeof type === 'string' ? builtin[type] || {} : {}
  }

  // https://github.com/microsoft/TypeScript/issues/17002
  // it never got fixed so we have to do this
  const isArray = Array.isArray as (arg: any) => arg is readonly any[]

  function resolveType(type: Type) {
    if (typeof type === 'function') {
      return type
    } else if (type instanceof RegExp) {
      return (source: string) => {
        if (type.test(source)) return source
        throw new Error()
      }
    } else if (isArray(type)) {
      return (source: string) => {
        if (type.includes(source)) return source
        throw new Error()
      }
    }
    return builtin[type]?.transform
  }

  const builtin: Dict<DomainConfig<any>> = {}

  export function createDomain<K extends keyof Domain>(name: K, transform: Transform<Domain[K]>, options?: DomainConfig<Domain[K]>) {
    builtin[name] = { ...options, transform }
  }

  createDomain('string', source => source)
  createDomain('text', source => source, { greedy: true })
  createDomain('rawtext', source => segment.unescape(source), { greedy: true })
  createDomain('boolean', () => true)

  createDomain('number', (source, session) => {
    const value = +source
    if (Number.isFinite(value)) return value
    throw new Error('internal.invalid-number')
  })

  createDomain('integer', (source, session) => {
    const value = +source
    if (value * 0 === 0 && Math.floor(value) === value) return value
    throw new Error('internal.invalid-integer')
  })

  createDomain('posint', (source, session) => {
    const value = +source
    if (value * 0 === 0 && Math.floor(value) === value && value > 0) return value
    throw new Error('internal.invalid-posint')
  })

  createDomain('natural', (source, session) => {
    const value = +source
    if (value * 0 === 0 && Math.floor(value) === value && value >= 0) return value
    throw new Error('internal.invalid-natural')
  })

  createDomain('date', (source, session) => {
    const timestamp = Time.parseDate(source)
    if (+timestamp) return timestamp
    throw new Error('internal.invalid-date')
  })

  createDomain('user', (source, session) => {
    if (source.startsWith('@')) {
      source = source.slice(1)
      if (source.includes(':')) return source
      return `${session.platform}:${source}`
    }
    const code = segment.from(source)
    if (code && code.type === 'at') {
      return `${session.platform}:${code.data.id}`
    }
    throw new Error('internal.invalid-user')
  })

  createDomain('channel', (source, session) => {
    if (source.startsWith('#')) {
      source = source.slice(1)
      if (source.includes(':')) return source
      return `${session.platform}:${source}`
    }
    const code = segment.from(source)
    if (code && code.type === 'sharp') {
      return `${session.platform}:${code.data.id}`
    }
    throw new Error('internal.invalid-channel')
  })

  const BRACKET_REGEXP = /<[^>]+>|\[[^\]]+\]/g

  interface DeclarationList extends Array<Declaration> {
    stripped: string
  }

  function parseDecl(source: string) {
    let cap: RegExpExecArray
    const result = [] as DeclarationList
    // eslint-disable-next-line no-cond-assign
    while (cap = BRACKET_REGEXP.exec(source)) {
      let rawName = cap[0].slice(1, -1)
      let variadic = false
      if (rawName.startsWith('...')) {
        rawName = rawName.slice(3)
        variadic = true
      }
      const [name, rawType] = rawName.split(':')
      const type = rawType ? rawType.trim() as DomainType : undefined
      result.push({
        name,
        variadic,
        type,
        required: cap[0][0] === '<',
      })
    }
    result.stripped = source.replace(/:[\w-]+[>\]]/g, str => str.slice(-1)).trimEnd()
    return result
  }

  export function parseValue(source: string, quoted: boolean, kind: string, argv: Argv, decl: Declaration = {}) {
    const { name, type } = decl

    // apply domain callback
    const transform = resolveType(type)
    if (transform) {
      try {
        return transform(source, argv.session)
      } catch (err) {
        if (!argv.session) {
          argv.error = `internal.invalid-${kind}`
        } else {
          const message = argv.session.text(err['message'] || 'internal.check-syntax')
          argv.error = argv.session.text(`internal.invalid-${kind}`, [name, message])
        }
        return
      }
    }

    // no explicit parameter
    if (source === '' && !quoted) return true

    // default behavior
    if (quoted) return source
    const n = +source
    return n * 0 === 0 ? n : source
  }

  export interface OptionConfig<T extends Type = Type> {
    value?: any
    fallback?: any
    type?: T
    authority?: number
    descPath?: string
  }

  export interface TypedOptionConfig<T extends Type> extends OptionConfig<T> {
    type: T
  }

  export interface OptionVariant extends OptionConfig {
    syntax: string
  }

  export interface OptionDeclaration extends Declaration, OptionVariant {
    values: Dict<any>
    /** @deprecated */
    valuesSyntax: Dict<string>
    variants: Dict<OptionVariant>
  }

  type OptionDeclarationMap = Dict<OptionDeclaration>

  export class CommandBase {
    public declaration: string

    public _arguments: Declaration[]
    public _options: OptionDeclarationMap = {}

    private _namedOptions: OptionDeclarationMap = {}
    private _symbolicOptions: OptionDeclarationMap = {}

    constructor(public readonly name: string, declaration: string, public ctx: Context) {
      if (!name) throw new Error('expect a command name')
      const decl = this._arguments = parseDecl(declaration)
      this.declaration = decl.stripped
    }

    _createOption(name: string, def: string, config: OptionConfig) {
      // do not use lookbehind assertion for Safari compatibility
      const cap = /^((?:-[\w-]*|[^<[\s\w\x80-\uffff])(?:,\s*(?:-[\w-]*|[^<[\s\w\x80-\uffff]))*)?((?:\s*\[[^\]]+?\]|\s*<[^>]+?>)*)(.*)$/.exec(def)
      const param = paramCase(name)
      let syntax = cap[1] || '--' + param
      const bracket = cap[2] || ''
      const desc = cap[3].trim()

      const names: string[] = []
      const symbols: string[] = []
      for (let param of syntax.trim().split(',')) {
        param = param.trimStart()
        const name = param.replace(/^-+/, '')
        if (!name || !param.startsWith('-')) {
          symbols.push(param)
        } else {
          names.push(name)
        }
      }

      if (!('value' in config) && !names.includes(param)) {
        syntax += ', --' + param
      }

      const declList = parseDecl(bracket.trimStart())
      if (declList.stripped) syntax += ' ' + declList.stripped
      const option = this._options[name] ||= {
        ...Command.defaultOptionConfig,
        ...declList[0],
        ...config,
        name,
        values: {},
        valuesSyntax: {},
        variants: {},
        syntax,
      }

      let path = `commands.${this.name}.options.${name}`
      const fallbackType = typeof option.fallback
      if ('value' in config) {
        path += '.' + config.value
        option.variants[config.value] = { ...config, syntax }
        option.valuesSyntax[config.value] = syntax
        names.forEach(name => option.values[name] = config.value)
      } else if (!bracket.trim()) {
        option.type = 'boolean'
      } else if (!option.type && (fallbackType === 'string' || fallbackType === 'number')) {
        option.type = fallbackType
      }

      if (desc) {
        this.ctx.i18n.define('', path, desc)
      }

      this._assignOption(option, names, this._namedOptions)
      this._assignOption(option, symbols, this._symbolicOptions)
      if (!this._namedOptions[param]) {
        this._namedOptions[param] = option
      }
    }

    private _assignOption(option: OptionDeclaration, names: readonly string[], optionMap: OptionDeclarationMap) {
      for (const name of names) {
        if (name in optionMap) {
          throw new Error(`duplicate option name "${name}" for command "${this.name}"`)
        }
        optionMap[name] = option
      }
    }

    removeOption<K extends string>(name: K) {
      if (!this._options[name]) return false
      const option = this._options[name]
      delete this._options[name]
      for (const key in this._namedOptions) {
        if (this._namedOptions[key] === option) {
          delete this._namedOptions[key]
        }
      }
      for (const key in this._symbolicOptions) {
        if (this._symbolicOptions[key] === option) {
          delete this._symbolicOptions[key]
        }
      }
      return true
    }

    parse(argv: string | Argv, terminator?: string, args: any[] = [], options: Dict<any> = {}): Argv {
      if (typeof argv === 'string') argv = Argv.parse(argv, terminator)

      if (!argv.source && argv.tokens) {
        argv.source = this.name + ' ' + Argv.stringify(argv)
      }

      while (!argv.error && argv.tokens?.length) {
        const token = argv.tokens[0]
        let { content, quoted } = token

        // greedy argument
        const argDecl = this._arguments[args.length]
        if (content[0] !== '-' && resolveConfig(argDecl?.type).greedy) {
          args.push(Argv.parseValue(Argv.stringify(argv), true, 'argument', argv, argDecl))
          break
        }

        // parse token
        argv.tokens.shift()
        let option: OptionDeclaration
        let names: string | string[]
        let param: string
        // symbolic option
        if (!quoted && (option = this._symbolicOptions[content])) {
          names = [paramCase(option.name)]
        } else {
          // normal argument
          if (content[0] !== '-' || quoted) {
            args.push(Argv.parseValue(content, quoted, 'argument', argv, argDecl || { type: 'string' }))
            continue
          }

          // find -
          let i = 0
          let name: string
          for (; i < content.length; ++i) {
            if (content.charCodeAt(i) !== 45) break
          }
          if (content.slice(i, i + 3) === 'no-' && !this._namedOptions[content.slice(i)]) {
            name = content.slice(i + 3)
            options[camelCase(name)] = false
            continue
          }

          // find =
          let j = i + 1
          for (; j < content.length; j++) {
            if (content.charCodeAt(j) === 61) break
          }
          name = content.slice(i, j)
          names = i > 1 ? [name] : name
          param = content.slice(++j)
          option = this._namedOptions[names[names.length - 1]]
        }

        // get parameter from next token
        quoted = false
        if (!param) {
          const { type } = option || {}
          if (resolveConfig(type).greedy) {
            param = Argv.stringify(argv)
            quoted = true
            argv.tokens = []
          } else if (type !== 'boolean' && argv.tokens.length && (type || argv.tokens[0]?.content !== '-')) {
            const token = argv.tokens.shift()
            param = token.content
            quoted = token.quoted
          }
        }

        // handle each name
        for (let j = 0; j < names.length; j++) {
          const name = names[j]
          const optDecl = this._namedOptions[name]
          const key = optDecl ? optDecl.name : camelCase(name)
          if (optDecl && name in optDecl.values) {
            options[key] = optDecl.values[name]
          } else {
            const source = j + 1 < names.length ? '' : param
            options[key] = Argv.parseValue(source, quoted, 'option', argv, optDecl)
          }
          if (argv.error) break
        }
      }

      // assign default values
      for (const { name, fallback } of Object.values(this._options)) {
        if (fallback !== undefined && !(name in options)) {
          options[name] = fallback
        }
      }

      delete argv.tokens
      return { ...argv, options, args, error: argv.error || '', command: this as any }
    }

    private stringifyArg(value: any) {
      value = '' + value
      return value.includes(' ') ? `"${value}"` : value
    }

    stringify(args: readonly string[], options: any) {
      let output = this.name
      for (const key in options) {
        const value = options[key]
        if (value === true) {
          output += ` --${key}`
        } else if (value === false) {
          output += ` --no-${key}`
        } else {
          output += ` --${key} ${this.stringifyArg(value)}`
        }
      }
      for (const arg of args) {
        output += ' ' + this.stringifyArg(arg)
      }
      return output
    }
  }
}
