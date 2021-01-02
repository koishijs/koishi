import { escapeRegExp } from 'koishi-utils'
import { Command } from './command'
import { NextFunction } from './context'
import { Channel, Tables, TableType, User } from './database'
import { Session } from './session'

export interface Token {
  rest?: string
  content: string
  quoted: boolean
  terminator: string
  inters: Argv[]
}

export interface ParsedArgv<O = {}> {
  args?: string[]
  options?: O
  source?: string
}

export interface Argv<U extends User.Field = never, G extends Channel.Field = never, O = {}> extends ParsedArgv<O> {
  session?: Session<U, G, O>
  command?: Command<U, G, O>
  rest?: string
  pos?: number
  root?: boolean
  tokens?: Token[]
  name?: string
  next?: NextFunction
}

const leftQuotes = `"'“‘`
const rightQuotes = `"'”’`

export namespace Argv {
  export class Tokenizer {
    private sepRE: RegExp

    constructor(public sep = '\\s', public brac: Record<string, string> = { '$(': ')' }) {
      this.sepRE = sep && new RegExp(`^${sep}+$`)
    }

    parseToken(source: string, terminator = ''): Token {
      const index = leftQuotes.indexOf(source[0])
      const quote = rightQuotes[index]
      let resource = `${this.sep}+|[${escapeRegExp(terminator)}]${this.sep}*|$`, content = ''
      if (quote) {
        source = source.slice(1)
        resource += `|${quote}(?=${resource})`
      }
      resource += `|${Object.keys(this.brac).map(escapeRegExp).join('|')}`
      const regExp = new RegExp(resource)
      const inters: Argv[] = []
      while (true) {
        const capture = regExp.exec(source)
        content += source.slice(0, capture.index)
        if (capture[0] in this.brac) {
          source = source.slice(capture.index + capture[0].length).trimStart()
          const { rest, tokens } = this.parse(source, this.brac[capture[0]])
          source = rest
          inters.push({ tokens, pos: content.length })
        } else {
          const quoted = capture[0] === quote
          const rest = source.slice(capture.index + +quoted).trimStart()
          if (!quoted && quote) {
            content = leftQuotes[index] + content
            inters.forEach(inter => inter.pos += 1)
          }
          return { quoted, terminator: capture[0], content, inters, rest }
        }
      }
    }

    parse(source: string, terminator = ''): Argv {
      const tokens: Token[] = []
      let rest = source
      // eslint-disable-next-line no-unmodified-loop-condition
      while (rest && !(terminator && rest.startsWith(terminator))) {
        const token = this.parseToken(rest, terminator)
        tokens.push(token)
        rest = token.rest
        delete token.rest
      }
      if (rest.startsWith(terminator)) rest = rest.slice(1)
      return { tokens, rest, source: source.slice(0, -rest.length) }
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

  export function from(source: string, terminator = '') {
    return defaultTokenizer.parse(source, terminator)
  }

  export function stringify(argv: Argv) {
    return defaultTokenizer.stringify(argv)
  }

  export function assign(argv1: ParsedArgv, argv2: ParsedArgv) {
    argv1.args = [...argv1.args || [], ...argv2.args]
    argv1.options = { ...argv1.options, ...argv2.options }
  }
}

export type FieldCollector<T extends TableType, K = keyof Tables[T], O = {}> =
  | Iterable<K>
  | ((argv: Argv<never, never, O>, fields: Set<keyof Tables[T]>) => void)

export function collectFields<T extends TableType>(argv: Argv, collectors: FieldCollector<T>[], fields: Set<keyof Tables[T]>) {
  for (const collector of collectors) {
    if (typeof collector === 'function') {
      collector(argv, fields)
      continue
    }
    for (const field of collector) {
      fields.add(field)
    }
  }
  return fields
}

function parseBracket(name: string, required: boolean): CommandArgument {
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

export interface CommandArgument {
  required: boolean
  variadic: boolean
  greedy: boolean
  name: string
}

const ANGLED_BRACKET_REGEXP = /<([^>]+)>/g
const SQUARE_BRACKET_REGEXP = /\[([^\]]+)\]/g

export function parseArguments(source: string) {
  let capture: RegExpExecArray
  const result: CommandArgument[] = []
  while ((capture = ANGLED_BRACKET_REGEXP.exec(source))) {
    result.push(parseBracket(capture[1], true))
  }
  while ((capture = SQUARE_BRACKET_REGEXP.exec(source))) {
    result.push(parseBracket(capture[1], false))
  }
  return result
}
