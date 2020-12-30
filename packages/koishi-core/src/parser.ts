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

export namespace Token {
  const leftQuotes = `"'“‘`
  const rightQuotes = `"'”’`

  export function from(source: string, terminator: string): Token {
    const index = leftQuotes.indexOf(source[0])
    const quote = rightQuotes[index]
    let resource = `[\\s${escapeRegExp(terminator)}]|$`, content = ''
    if (quote) {
      source = source.slice(1)
      resource += `|${quote}(?=${resource})`
    }
    const regExp = new RegExp(resource + '|\\$\\(')
    const inters: Argv[] = []
    while (true) {
      const capture = regExp.exec(source)
      content += source.slice(0, capture.index)
      if (capture[0] === '$(') {
        const { rest, tokens } = Argv.from(source.slice(capture.index + 2).trimStart(), ')')
        source = rest
        inters.push({ tokens, pos: content.length })
      } else {
        const quoted = capture[0] === quote
        const rest = terminator.includes(capture[0])
          ? source.slice(capture.index).trimStart()
          : source.slice(capture.index + 1).trimStart()
        if (!quoted && quote) {
          content = leftQuotes[index] + content
          inters.forEach(inter => inter.pos += 1)
        }
        return { quoted, terminator: capture[0], content, inters, rest }
      }
    }
  }
}

export interface ParsedArgv<O = {}> {
  args?: string[]
  options?: O
}

export interface Argv<U extends User.Field = never, G extends Channel.Field = never, O = {}> extends ParsedArgv<O> {
  source?: string
  session?: Session<U, G, O>
  command?: Command<U, G, O>
  rest?: string
  pos?: number
  root?: boolean
  tokens?: Token[]
  name?: string
  next?: NextFunction
}

export namespace Argv {
  export function from(source: string, terminator = ''): Argv {
    const tokens: Token[] = []
    let rest = source
    // eslint-disable-next-line no-unmodified-loop-condition
    while (rest && !(terminator && rest.startsWith(terminator))) {
      const token = Token.from(rest, terminator)
      tokens.push(token)
      rest = token.rest
      delete token.rest
    }
    if (rest.startsWith(terminator)) rest = rest.slice(1)
    return { tokens, rest, source: source.slice(0, -rest.length) }
  }

  export function assign(argv1: ParsedArgv, argv2: ParsedArgv) {
    argv1.args = [...argv1.args || [], ...argv2.args || []]
    argv1.options = { ...argv1.options, ...argv2.options }
  }

  export function stringify(argv: Argv) {
    return argv.tokens.map(token => token.content).join(' ')
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
