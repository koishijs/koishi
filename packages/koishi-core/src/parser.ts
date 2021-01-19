import { camelCase, escapeRegExp, paramCase } from 'koishi-utils'
import { format } from 'util'
import { Command } from './command'
import { NextFunction } from './context'
import { Channel, User } from './database'
import { Session } from './session'

export interface Token {
  rest: string
  content: string
  quoted: boolean
  terminator: string
  inters: Argv[]
}

export interface Argv<U extends User.Field = never, G extends Channel.Field = never, A extends any[] = any[], O = {}> {
  args?: A
  options?: O
  source?: string
  initiator?: string
  session?: Session<U, G>
  command?: Command<U, G, A, O>
  rest?: string
  pos?: number
  root?: boolean
  parent?: Token
  tokens?: Token[]
  name?: string
  next?: NextFunction
}

const leftQuotes = `"'“‘`
const rightQuotes = `"'”’`

export namespace Argv {
  export interface Interpolation {
    terminator?: string
    parse?(source: string): Argv
  }

  const bracs: Record<string, Interpolation> = {}

  export function interpolate(initiator: string, terminator: string, parse?: (source: string) => Argv) {
    bracs[initiator] = { terminator, parse }
  }

  interpolate('$(', ')')

  export class Tokenizer {
    private sepRE: RegExp
    private bracs: Record<string, Interpolation>

    constructor(public sep = '\\s') {
      this.sepRE = new RegExp(`^${sep}+$`)
      this.bracs = { ...bracs }
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
        stopReg += `|${quote}(?=${stopReg})`
      }
      stopReg += `|${Object.keys(this.bracs).map(escapeRegExp).join('|')}`
      const regExp = new RegExp(stopReg)
      while (true) {
        const capture = regExp.exec(source)
        content += source.slice(0, capture.index)
        if (capture[0] in this.bracs) {
          source = source.slice(capture.index + capture[0].length).trimStart()
          const { parse, terminator } = this.bracs[capture[0]]
          const argv = parse?.(source) || this.parse(source, terminator)
          source = argv.rest
          parent.inters.push({ ...argv, pos: content.length, initiator: capture[0], parent })
        } else {
          const quoted = capture[0] === quote
          const rest = source.slice(capture.index + +quoted).trimStart()
          if (!quoted && quote) {
            content = leftQuotes[index] + content
            parent.inters.forEach(inter => inter.pos += 1)
          }
          parent.rest = rest
          parent.quoted = quoted
          parent.content = content
          parent.terminator = capture[0]
          if (quote === "'") Argv.revert(parent)
          return parent
        }
      }
    }

    parse(source: string, terminator = ''): Argv {
      const tokens: Token[] = []
      let rest = source, term = ''
      const stopReg = `${this.sep}+|[${escapeRegExp(terminator)}]${this.sep}*|$`
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
      return { tokens, rest, source }
    }

    stringify(argv: Argv) {
      return argv.tokens.map((token) => {
        return this.sepRE.test(token.terminator)
          ? token.content + token.terminator
          : token.content
      }).join('')
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
}

export interface Domain {
  string: string
  number: number
  boolean: boolean
  user: string
  /** @builtin greedy argument */
  text: string
}

export namespace Domain {
  export type Type = keyof Domain

  type GetDomain<T extends string, F> = T extends Type ? Domain[T] : F

  type GetParamDomain<S extends string, X extends string, F>
    = S extends `${any}${X}${infer T}` ? GetDomain<T, F> : F

  type Replace<S extends string, X extends string, Y extends string>
    = S extends `${infer L}${X}${infer R}` ? `${L}${Y}${Replace<R, X, Y>}` : S

  type Extract<S extends string, X extends string, Y extends string, F>
    = S extends `${infer L}${Y}${infer R}` ? [GetParamDomain<L, X, F>, ...Extract<R, X, Y, F>] : []

  type ExtractFirst<S extends string, X extends string, Y extends string, F>
    = S extends `${infer L}${Y}${any}` ? GetParamDomain<L, X, F> : boolean

  export type ArgumentType<S extends string> = [...Extract<Replace<S, '>', ']'>, ':', ']', string>, ...string[]]

  export type OptionType<S extends string> = ExtractFirst<Replace<S, '>', ']'>, ':', ']', any>

  export interface Declaration {
    name?: string
    type?: Type
    fallback?: any
    variadic?: boolean
    required?: boolean
  }

  export type Transform<T> = (source: string) => T

  const builtin: Record<string, Transform<any>> = {}

  export function create<K extends keyof Domain>(name: K, callback: Transform<Domain[K]>) {
    builtin[name] = callback
  }

  create('string', source => source)
  create('number', source => +source)
  create('user', (source) => {
    const cap = /\[CQ:at,qq=(\d+)\]/.exec(source)
    if (cap) return cap[1]
    // TODO by nickname
    return source
  })

  export function parseValue(source: string, quoted: boolean, { type, fallback }: Declaration = {}) {
    // no explicit parameter & has fallback
    const implicit = source === '' && !quoted
    if (implicit && fallback !== undefined) return fallback

    // apply domain callback
    if (type in builtin) return builtin[type](source)

    // default behavior
    if (implicit) return true
    const n = +source
    return n * 0 === 0 ? n : source
  }

  const BRACKET_REGEXP = /<[^>]+>|\[[^\]]+\]/g

  interface DeclarationList extends Array<Declaration> {
    stripped: string
  }

  export function parseDeclaration(source: string) {
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
      const type = rawType ? rawType.trim() as Type : null
      result.push({
        name,
        variadic,
        type,
        required: cap[0][0] === '<',
      })
    }
    result.stripped = source.replace(/:[\w-]+[>\]]/g, str => str.slice(-1))
    return result
  }

  export interface OptionConfig {
    value?: any
    /** hide the option by default */
    hidden?: boolean
    authority?: number
    notUsage?: boolean
    validate?: RegExp | ((value: any) => void | string | boolean)
  }

  export interface OptionDeclaration extends Declaration, OptionConfig {
    description?: string
    values?: Record<string, any>
  }

  type OptionDeclarationMap = Record<string, OptionDeclaration>

  export class CommandBase {
    public declaration: string

    public _arguments: Declaration[]
    public _options: OptionDeclarationMap = {}

    private _namedOptions: OptionDeclarationMap = {}
    private _symbolicOptions: OptionDeclarationMap = {}

    constructor(public name: string, declaration: string) {
      if (!name) throw new Error('expect a command name')
      this.declaration = (this._arguments = parseDeclaration(declaration)).stripped
    }

    _createOption(name: string, def: string, config?: OptionConfig) {
      const param = paramCase(name)
      const decl = def.replace(/(?<=^|\s)[\w\x80-\uffff].*/, '')
      const desc = def.slice(decl.length)
      let syntax = decl.replace(/(?<=^|\s)(<[^<]+>|\[[^[]+\]).*/, '')
      const bracket = decl.slice(syntax.length)
      syntax = syntax.trim() || '--' + param

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

      if (!config.value && !names.includes(param)) {
        syntax += ', --' + param
      }

      const declList = parseDeclaration(bracket)
      const option = this._options[name] ||= {
        ...Command.defaultOptionConfig,
        ...config,
        ...declList[0],
        name,
        values: {},
        description: syntax + '  ' + declList.stripped + desc,
      }

      if ('value' in config) {
        names.forEach(name => option.values[name] = config.value)
      } else if (!bracket.trim()) {
        option.type = 'boolean'
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
          throw new Error(format('duplicate option names: "%s"', name))
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

    parse(argv: Argv): Argv {
      const args: string[] = []
      const options: Record<string, any> = {}
      const source = this.name + ' ' + Argv.stringify(argv)

      const handleOption = (name: string, value: any) => {
        const config = this._namedOptions[name]
        if (config) {
          options[config.name] = name in config.values ? config.values[name] : value
        } else {
          options[camelCase(name)] = value
        }
      }

      while (argv.tokens.length) {
        const token = argv.tokens[0]
        let { content, quoted } = token

        // greedy argument
        if (content[0] !== '-' && this._arguments[args.length]?.type === 'text') {
          args.push(Argv.stringify(argv))
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
            args.push(content)
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
            handleOption(name, false)
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
          if (type === 'text') {
            param = Argv.stringify(argv)
            quoted = true
            argv.tokens = []
          } else if (type !== 'boolean' && (type || argv.tokens[0]?.content !== '-')) {
            const token = argv.tokens.shift()
            param = token.content
            quoted = token.quoted
          }
        }

        // handle each name
        for (let j = 0; j < names.length; j++) {
          const name = names[j]
          const config = this._namedOptions[name]
          const value = parseValue(j + 1 < names.length ? '' : param, quoted, config)
          handleOption(name, value)
        }
      }

      // assign default values
      for (const { name, fallback } of Object.values(this._options)) {
        if (fallback !== undefined && !(name in options)) {
          options[name] = fallback
        }
      }

      delete argv.tokens
      return { options, args, source }
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
