import { Context, makeArray, MaybeArray } from 'koishi'

interface Modifier {
  $filter?: Selection
  $isolate?: string[]
}

const selectors = ['user', 'guild', 'channel', 'self', 'private', 'platform'] as const

export type SelectorType = typeof selectors[number]
export type SelectorValue = boolean | MaybeArray<string | number>
export type BaseSelection = { [K in SelectorType]?: SelectorValue }

interface Selection extends BaseSelection {
  and?: Selection[]
  or?: Selection[]
  not?: Selection
}

export function select(root: Context, options: Selection) {
  let ctx = root

  // basic selectors
  for (const type of selectors) {
    const value = options[type]
    if (value === true) {
      ctx = ctx[type]()
    } else if (value === false) {
      ctx = ctx.exclude(ctx[type]())
    } else if (value !== undefined) {
      // we turn everything into string
      ctx = ctx[type](...makeArray(value).map(item => '' + item))
    }
  }

  // intersect
  if (options.and) {
    for (const selection of options.and) {
      ctx = ctx.intersect(select(root, selection))
    }
  }

  // union
  if (options.or) {
    let ctx2: Context = ctx.never()
    for (const selection of options.or) {
      ctx2 = ctx2.union(select(root, selection))
    }
    ctx = ctx.intersect(ctx2)
  }

  // exclude
  if (options.not) {
    ctx = ctx.exclude(select(root, options.not))
  }

  return ctx
}

export function patch(ctx: Context, config: Modifier) {
  config ||= {}
  const parent = Object.getPrototypeOf(ctx)

  if (config.$filter) {
    ctx.filter = parent.intersect(select(ctx.any(), config.$filter)).filter
  } else {
    delete ctx.filter
  }

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
