import text from '../chinese.txt'

const [simplified, traditional] = text.split(/\r?\n/)

const stMap = new Map<string, string>()
const tsMap = new Map<string, string>()

simplified.split('').forEach((char, index) => {
  stMap.set(char, traditional[index])
  tsMap.set(traditional[index], char)
})

export function traditionalize(source: string) {
  let result = ''
  for (const char of source) {
    result += stMap.get(char) || char
  }
  return result
}

export function simplify(source: string) {
  let result = ''
  for (const char of source) {
    result += tsMap.get(char) || char
  }
  return result
}

function deepen(modifyString: (source: string) => string) {
  function modifyObject<T extends unknown>(source: T): T {
    if (typeof source !== 'object' || !source) return source
    if (Array.isArray(source)) return source.map(modifyObject) as any
    const result = {} as any
    for (const key in source) {
      result[modifyString(key)] = modifyObject(source[key])
    }
    return result as T
  }

  return function<T> (source: T): T {
    if (typeof source === 'string') {
      return modifyString(source) as any
    } else {
      return modifyObject(source)
    }
  }
}

export const camelCase = deepen(source => source.replace(/[_-][a-z]/g, str => str.slice(1).toUpperCase()))
export const paramCase = deepen(source => source.replace(/_/g, '-').replace(/(?<!^)[A-Z]/g, str => '-' + str.toLowerCase()))
export const snakeCase = deepen(source => source.replace(/-/g, '_').replace(/(?<!^)[A-Z]/g, str => '_' + str.toLowerCase()))

export const camelize = camelCase
export const hyphenate = paramCase

export function capitalize(source: string) {
  return source.charAt(0).toUpperCase() + source.slice(1)
}

// eslint-disable-next-line no-new-func
export const interpolate = new Function('template', 'context', `
  return template.replace(/\\{\\{[\\s\\S]+?\\}\\}/g, (sub) => {
    const expr = sub.substring(2, sub.length - 2)
    try {
      with (context) {
        return eval(expr)
      }
    } catch {
      return ''
    }
  })
`) as ((template: string, context: object) => string)

export function escapeRegExp(source: string) {
  return source
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d')
}

export function trimSlash(source: string) {
  return source.replace(/\/$/, '')
}

export function sanitize(source: string) {
  if (!source.startsWith('/')) source = '/' + source
  return trimSlash(source)
}

export function template(path: string | string[], ...params: any[]) {
  if (!Array.isArray(path)) path = [path]
  for (const item of path) {
    const source = template.get(item)
    if (typeof source === 'string') {
      return template.format(source, ...params)
    }
  }
  return path[0]
}

function deepAssign(head: any, base: any): any {
  Object.entries(base).forEach(([key, value]) => {
    if (typeof value === 'object' && typeof head[key] === 'object') {
      head[key] = deepAssign(head[key], value)
    } else {
      head[key] = base[key]
    }
  })
  return head
}

export namespace template {
  export type Node = string | Store

  export interface Store {
    [K: string]: Node
  }

  const store: Store = {}

  export function set(path: string, value: Node) {
    const seg = path.split('.')
    let node: Node = store
    while (seg.length > 1) {
      node = node[seg.shift()] ||= {}
    }
    deepAssign(node, { [seg[0]]: value })
  }

  export function get(path: string) {
    const seg = path.split('.')
    let node: Node = store
    do {
      node = node[seg.shift()]
    } while (seg.length && node)
    if (typeof node === 'string') return node
  }

  export function format(source: string, ...params: any[]) {
    if (params[0] && typeof params[0] === 'object') {
      source = interpolate(source, params[0])
    }
    let result = ''
    let cap: RegExpExecArray
    // eslint-disable-next-line no-cond-assign
    while (cap = /\{(\w+)\}/.exec(source)) {
      result += source.slice(0, cap.index) + (cap[1] in params ? params[cap[1]] : '')
      source = source.slice(cap.index + cap[0].length)
    }
    return result + source
  }

  export function quote(content: any) {
    return get('basic.left-quote') + content + get('basic.right-quote')
  }

  export function brace(items: any[]) {
    if (!items.length) return ''
    return get('basic.left-brace') + items.join(get('basic.comma')) + get('basic.right-brace')
  }
}

export { template as t }

/* eslint-disable quote-props */
template.set('basic', {
  'left-brace': '（',
  'right-brace': '）',
  'left-quote': '“',
  'right-quote': '”',
  'comma': '，',
  'and': '和',
  'or': '或',
})
