import { Context } from 'koishi'

interface Modifier {
  $isolate?: string[]
}

export function patch(ctx: Context, config: Modifier) {
  config ||= {}
  const parent = Object.getPrototypeOf(ctx)

  const oldMapping = { ...ctx }.mapping || {}
  if (config.$isolate) {
    ctx.mapping = parent.isolate(config.$isolate).mapping
  } else {
    delete ctx.mapping
  }

  const neoMapping = { ...ctx }.mapping || {}
  for (const name in { ...oldMapping, ...neoMapping }) {
    const oldValue = ctx.app[oldMapping[name] || name]
    const neoValue = ctx.app[neoMapping[name] || name]
    if (oldValue === neoValue) continue
    const self: Context = Object.create(ctx)
    self[Context.filter] = (target) => {
      return ctx.mapping[name] === target.mapping[name]
    }
    ctx.emit(self, 'internal/service', name)
  }
}

export function separate(config: any) {
  const pick = {}, omit = {}
  for (const [key, value] of Object.entries(config || {})) {
    if (key.startsWith('$')) {
      pick[key] = value
    } else {
      omit[key] = value
    }
  }
  return [pick, omit]
}

export function deepEqual(a: any, b: any) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (!a || !b) return false

  // check array
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  } else if (Array.isArray(b)) {
    return false
  }

  // check object
  return Object.keys({ ...a, ...b }).every(key => deepEqual(a[key], b[key]))
}
