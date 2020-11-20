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
with (context) {
  return template.replace(/\\{\\{[\\s\\S]+?\\}\\}/g, (sub) => {
    const expr = sub.substring(2, sub.length - 2)
    return eval(expr)
  })
}`)

export function escapeRegExp(source: string) {
  return source
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d')
}
