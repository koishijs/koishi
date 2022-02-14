export function serialize(obj: unknown): string {
  if (obj instanceof Date) return `"d${obj.toJSON()}"`
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'string') return 's' + value
    if (typeof value === 'object') {
      if (value instanceof Date) return 'd' + new Date(value).toJSON()
      if (value === null) return null
      const o = Array.isArray(value) ? [] : {}
      for (const k in value) {
        if (value[k] instanceof Date) {
          o[k] = new Date(value[k])
          // Remove toJson so that it won't be converted to string in recursive calls
          o[k].toJSON = undefined
        } else {
          o[k] = value[k]
        }
      }
      return o
    }
    return value
  })
}

export function deserialize(str: string): unknown {
  if (str === undefined) return undefined
  return JSON.parse(str, (_, v) =>
    typeof v === 'string'
      ? v[0] === 's'
        ? v.slice(1)
        : new Date(v.slice(1))
      : v,
  )
}
