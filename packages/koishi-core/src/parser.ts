import { escapeRegExp } from 'koishi-utils'
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

export interface Argv<U extends User.Field = never, G extends Channel.Field = never, O = {}> {
  args?: string[]
  options?: O
  source?: string
  initiator?: string
  session?: Session<U, G, O>
  command?: Command<U, G, O>
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
  type?: string
  fallback?: any
}

export namespace Domain {
  export type Callback<T = any> = (source: string) => T

  const builtin: Record<string, Callback> = {}

  export function create(name: string, callback: Callback) {
    builtin[name] = callback
  }

  create('string', source => source)
  create('number', source => +source)

  export function parseValue(source: string, quoted: boolean, { type, fallback }: Domain = {}) {
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

  export interface ArgumentDecl extends Domain {
    required: boolean
    variadic: boolean
    greedy: boolean
    name: string
  }

  function parseBracket(name: string, required: boolean): ArgumentDecl {
    let variadic = false, greedy = false
    if (name.startsWith('...')) {
      name = name.slice(3)
      variadic = true
    } else if (name.endsWith('...')) {
      name = name.slice(0, -3)
      greedy = true
    }
    return {
      name,
      required,
      variadic,
      greedy,
    }
  }

  const ANGLED_BRACKET_REGEXP = /<([^>]+)>/g
  const SQUARE_BRACKET_REGEXP = /\[([^\]]+)\]/g

  export function parseArgDecl(source: string) {
    let capture: RegExpExecArray
    const result: ArgumentDecl[] = []
    while ((capture = ANGLED_BRACKET_REGEXP.exec(source))) {
      result.push(parseBracket(capture[1], true))
    }
    while ((capture = SQUARE_BRACKET_REGEXP.exec(source))) {
      result.push(parseBracket(capture[1], false))
    }
    return result
  }

  export interface OptionConfig<T = any> {
    value?: T
    fallback?: T
    /** hide the option by default */
    hidden?: boolean
    authority?: number
    notUsage?: boolean
    validate?: RegExp | ((value: any) => void | string | boolean)
  }

  export interface OptionDecl extends Domain, OptionConfig {
    name: string
    description: string
    greedy: boolean
    values?: Record<string, any>
  }

  export function parseOptionDecl() {}
}
