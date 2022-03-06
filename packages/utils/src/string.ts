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
export const paramCase = deepen(source => uncapitalize(source).replace(/_/g, '-').replace(/(?<!^)[A-Z]/g, str => '-' + str.toLowerCase()))
export const snakeCase = deepen(source => uncapitalize(source).replace(/-/g, '_').replace(/(?<!^)[A-Z]/g, str => '_' + str.toLowerCase()))

export const camelize = camelCase
export const hyphenate = paramCase

namespace Letter {
  /* eslint-disable @typescript-eslint/member-delimiter-style */
  interface LowerToUpper {
    a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', h: 'H', i: 'I', j: 'J', k: 'K', l: 'L', m: 'M',
    n: 'N', o: 'O', p: 'P', q: 'Q', r: 'R', s: 'S', t: 'T', u: 'U', v: 'V', w: 'W', x: 'X', y: 'Y', z: 'Z',
  }

  interface UpperToLower {
    A: 'a', B: 'b', C: 'c', D: 'd', E: 'e', F: 'f', G: 'g', H: 'h', I: 'i', J: 'j', K: 'k', L: 'l', M: 'm',
    N: 'n', O: 'o', P: 'p', Q: 'q', R: 'r', S: 's', T: 't', U: 'u', V: 'v', W: 'w', X: 'x', Y: 'y', Z: 'z',
  }
  /* eslint-enable @typescript-eslint/member-delimiter-style */

  export type Upper = keyof UpperToLower
  export type Lower = keyof LowerToUpper

  export type ToUpper<S extends string> = S extends Lower ? LowerToUpper[S] : S
  export type ToLower<S extends string, P extends string = ''> = S extends Upper ? `${P}${UpperToLower[S]}` : S
}

/* eslint-disable @typescript-eslint/naming-convention */
export type camelize<S extends string> = S extends `${infer L}-${infer M}${infer R}` ? `${L}${Letter.ToUpper<M>}${camelize<R>}` : S
export type hyphenate<S extends string> = S extends `${infer L}${infer R}` ? `${Letter.ToLower<L, '-'>}${hyphenate<R>}` : S
/* eslint-enable @typescript-eslint/naming-convention */

export function capitalize(source: string) {
  return source.charAt(0).toUpperCase() + source.slice(1)
}

export function uncapitalize(source: string) {
  return source.charAt(0).toLowerCase() + source.slice(1)
}

// eslint-disable-next-line no-new-func
export const interpolate = new Function('template', 'context', 'pattern', `
  return template.replace(pattern || /\\{\\{([\\s\\S]+?)\\}\\}/g, (_, expr) => {
    try {
      with (context) {
        const result = eval(expr)
        return result === undefined ? '' : result
      }
    } catch {
      return ''
    }
  })
`) as ((template: string, context: object, pattern?: RegExp) => string)

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

/** @deprecated use template service instead */
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

template.set('basic', {
  'left-brace': '（',
  'right-brace': '）',
  'left-quote': '“',
  'right-quote': '”',
  'comma': '，',
  'and': '和',
  'or': '或',
})
