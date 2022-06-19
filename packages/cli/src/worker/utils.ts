import { Context, Dict, makeArray, MaybeArray } from 'koishi'

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
  patch.filter(ctx, config.$filter)
  patch.isolate(ctx, config.$isolate)
}

export namespace patch {
  export function filter(ctx: Context, filter: Selection) {
    const parent = Object.getPrototypeOf(ctx)
    if (filter) {
      ctx.filter = parent.intersect(select(ctx.any(), filter)).filter
    } else {
      delete ctx.filter
    }
  }

  export function isolate(ctx: Context, isolate: string[]) {
    const updated: Dict<boolean> = {}
    const { delimiter } = ctx

    // remove isolation
    for (const name of Object.keys(ctx.mapping)) {
      if (isolate?.includes(name)) continue
      const oldKey = ctx.mapping[name]
      const value = ctx.app[oldKey]
      delete ctx.mapping[name]
      const neoKey = ctx.mapping[name] || name
      if (value === ctx.app[neoKey]) continue
      const source = value?.[Context.source]
      updated[name] = source?.[delimiter]
      if (updated[name]) {
        // free right hand side service
        source[name] = value
        ctx.app[oldKey] = null
      }
    }

    // add isolation
    for (const name of isolate || []) {
      if (ctx.mapping[name]) continue
      const oldKey = ctx.mapping[name] || name
      const value = ctx.app[oldKey]
      ctx.mapping[name] = Symbol(name)
      const neoKey = ctx.mapping[name]
      if (value === ctx.app[neoKey]) continue
      const source = value?.[Context.source]
      updated[name] = source?.[delimiter]
      if (updated[name]) {
        // lock right hand side service
        source[name] = value
        ctx.app[oldKey] = null
      }
    }

    const parent = Object.getPrototypeOf(ctx)
    for (const name in updated) {
      const self: Context = Object.create(ctx)
      const source = updated[name] ? parent : ctx
      self[Context.filter] = (target) => {
        return source.mapping[name] === target.mapping[name] && updated[name] !== target[delimiter]
      }
      ctx.emit(self, 'internal/service', name)
    }
  }
}

export function stripModifier(config: any) {
  const result = {}
  for (const [key, value] of Object.entries(config || {})) {
    if (key.startsWith('$')) continue
    result[key] = value
  }
  return result
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
