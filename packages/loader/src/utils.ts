import { Context, isNullable, makeArray, MaybeArray } from '@koishijs/core'

export function isDefiniteFalsy(value: any) {
  return !isNullable(value) && !value
}

export function unwrapExports(module: any) {
  return module?.default || module
}

export interface Modifier {
  $if?: boolean
  $filter?: Selection
}

export namespace Modifier {
  export function pick(config: any, positive = false) {
    const result = {}
    for (const [key, value] of Object.entries(config || {})) {
      if (key.startsWith('$') !== positive) continue
      result[key] = value
    }
    return result
  }
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
  config ??= {}
  const parent = Object.getPrototypeOf(ctx)
  if (config.$filter) {
    ctx.filter = parent.intersect(select(ctx.root, config.$filter)).filter
  } else {
    delete ctx.filter
  }
}
