import { camelCase } from 'koishi-utils'

const ANGLED_BRACKET_REGEXP = /<([^>]+)>/g
const SQUARE_BRACKET_REGEXP = /\[([^\]]+)\]/g

export function removeBrackets (source: string) {
  return source.replace(/[<[].+/, '').trim()
}

function parseBracket (name: string, required: boolean): CommandArgument {
  let variadic = false, noSegment = false
  if (name.startsWith('...')) {
    name = name.slice(3)
    variadic = true
  } else if (name.endsWith('...')) {
    name = name.slice(0, -3)
    noSegment = true
  }
  return {
    name,
    required,
    variadic,
    noSegment,
  }
}

export interface CommandArgument {
  required: boolean
  variadic: boolean
  noSegment: boolean
  name: string
}

export function parseArguments (source: string) {
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

export interface OptionConfig {
  default?: any
  hidden?: boolean
  authority?: number
  notUsage?: boolean
  isString?: boolean
  noNegated?: boolean
}

export interface CommandOption extends OptionConfig {
  rawName: string
  longest: string
  names: string[]
  camels: string[]
  negated: string[]
  required: boolean
  isBoolean: boolean
  description: string
}

export function parseOption (rawName: string, description: string, config: OptionConfig = {}, optsDef: Record<string, CommandOption>): CommandOption {
  config = { authority: 0, ...config }

  const negated: string[] = []
  const camels: string[] = []
  let required = false, isBoolean = false, longest = ''
  const names = removeBrackets(rawName).split(',').map((name: string) => {
    name = name.trim()
    if (name.length > longest.length) longest = name
    name = name.replace(/^-{1,2}/, '')
    if (name.startsWith('no-') && !config.noNegated && !optsDef[name.slice(3)]) {
      name = name.slice(3)
      const camel = camelCase(name)
      negated.push(camel)
      camels.push(camel)
    } else {
      camels.push(camelCase(name))
    }
    return name
  })

  if (rawName.includes('<')) {
    required = true
  } else if (!rawName.includes('[')) {
    isBoolean = true
  }

  return {
    ...config,
    rawName,
    longest,
    names,
    camels,
    negated,
    required,
    isBoolean,
    description,
  }
}

interface ParsedArg0 {
  rest: string
  content: string
  quoted: boolean
}

function parseArg0 (source: string): ParsedArg0 {
  const char0 = source[0]
  if (char0 === '"' || char0 === "'" || char0 === '“' || char0 === '”') {
    const [content] = source.slice(1).split(/["'“”](?=\s|$)/, 1)
    return {
      quoted: true,
      content,
      rest: source.slice(2 + content.length).trimLeft(),
    }
  }

  const [content] = source.split(/\s/, 1)
  return { content, quoted: false, rest: source.slice(content.length).trimLeft() }
}

export function parseValue (source: string | true, quoted: boolean, config = {} as CommandOption) {
  // quoted empty string
  if (source === '' && quoted) return ''
  // no explicit parameter
  if (source === true || source === '') {
    if (config.default !== undefined) return config.default
    if (config.isString) return ''
    return true
  }
  // default behavior
  if (config.isString) return source
  const n = +source
  return n * 0 === 0 ? n : source
}

export interface ParsedLine {
  rest: string
  args: string[]
  unknown: string[]
  options: Record<string, any>
}

export function parseLine (source: string, argsDef: CommandArgument[], optsDef: Record<string, CommandOption>) {
  let arg: string, name: string, arg0: ParsedArg0, rest = ''
  const args: string[] = []
  const unknown: string[] = []
  const options: Record<string, any> = {}

  function handleOption (name: string, knownValue: any, unknownValue: any) {
    const config = optsDef[name]
    if (config) {
      for (const alias of config.camels) {
        options[alias] = !config.negated.includes(alias) && knownValue
      }
    } else {
      // unknown option name
      options[camelCase(name)] = unknownValue
      if (!unknown.includes(name)) {
        unknown.push(name)
      }
    }
  }

  while (source) {
    // long argument
    if (source[0] !== '-' && argsDef[args.length] && argsDef[args.length].noSegment) {
      args.push(source)
      break
    }

    // parse argv0
    arg0 = parseArg0(source)
    arg = arg0.content
    source = arg0.rest
    if (arg[0] !== '-' || arg0.quoted) {
      // normal argument
      args.push(arg)
      continue
    } else if (arg === '--') {
      // rest part
      rest = arg0.rest
      break
    }

    // find -
    let i = 0
    for (; i < arg.length; ++i) {
      if (arg.charCodeAt(i) !== 45) break
    }
    if (arg.slice(i, i + 3) === 'no-') {
      name = arg.slice(i + 3)
      handleOption(name, true, false)
      continue
    }

    // find =
    let j = i + 1
    for (; j < arg.length; j++) {
      if (arg.charCodeAt(j) === 61) break
    }
    name = arg.slice(i, j)
    const names = i === 2 ? [name] : name

    // get parameter
    let quoted = false
    let param: any = arg.slice(++j)
    const lastConfig = optsDef[names[names.length - 1]]
    if (!param && source.charCodeAt(0) !== 45 && (!lastConfig || !lastConfig.isBoolean)) {
      arg0 = parseArg0(source)
      param = arg0.content
      quoted = arg0.quoted
      source = arg0.rest
    }

    // handle each name
    for (j = 0; j < names.length; j++) {
      name = names[j]
      const config = optsDef[name]
      const value = parseValue((j + 1 < names.length) || param, quoted, config)
      handleOption(name, value, value)
    }
  }

  // assign default values
  for (const name in optsDef) {
    if (optsDef[name].default !== undefined && !(name in options)) {
      options[name] = optsDef[name].default
    }
  }

  return { options, rest, unknown, args } as ParsedLine
}
