function deepen(modifyString: (source: string) => string) {
  function modifyObject <T>(source: T): T {
    if (typeof source !== 'object' || !source) return source
    if (Array.isArray(source)) return source.map(modifyObject) as any
    const result = {} as T
    for (const key in source) {
      result[modifyString(key)] = modifyObject(source[key])
    }
    return result
  }

  return function <T> (source: T): T {
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
