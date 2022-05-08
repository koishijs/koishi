import { Database, Keys } from 'koishi'
import { message, send } from '@koishijs/client'

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

export function deserialize(str: string): any {
  if (str === undefined) return undefined
  return JSON.parse(str, (_, v) =>
    typeof v === 'string'
      ? v[0] === 's'
        ? v.slice(1)
        : new Date(v.slice(1))
      : v,
  )
}

export async function sendQuery<K extends Keys<Database, Function>>(name: K, ...args: Parameters<Database[K]>): Promise<ReturnType<Database[K]>> {
  return deserialize(await send(`database/${name}`, ...args.map(serialize) as any))
}

export function formatSize(size: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  for (const idx in units) {
    if (idx && size > 1024) { size /= 1024 } else { return `${size.toFixed(1)} ${units[idx]}` }
  }
  return `${size.toFixed(1)} ${units[units.length - 1]}`
}

export function handleError(e, msg: string = '') {
  console.warn(e)
  if (msg.length) msg += '：'
  if (e instanceof Error) msg += e.name
  else if (typeof e === 'string') {
    msg += e.split('\n')[0]
  }
  return message.error(msg)
}
function pad0(n: number) {
  return n.toString().padStart(2, '0')
}
export function timeStr(date: Date) {
  return [
    pad0(date.getHours()),
    pad0(date.getMinutes()),
    pad0(date.getSeconds()),
  ].join(':')
}
