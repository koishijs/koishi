import { defineProperty, isType, noop } from './misc'
import { Logger } from './logger'

const logger = new Logger('observer')
const staticTypes = ['number', 'string', 'bigint', 'boolean', 'symbol', 'function']
const builtinClasses = ['Date', 'RegExp', 'Set', 'Map', 'WeakSet', 'WeakMap', 'Array']

function observeProperty(value: any, proxy: any, key: any, label: string, update: any) {
  if (isType('Date', value)) {
    return proxy[key] = observeDate(value, update)
  } else if (Array.isArray(value)) {
    return proxy[key] = observeArray(value, label, update)
  } else {
    return proxy[key] = observeObject(value, label, update)
  }
}

function observeObject<T extends object>(target: T, label: string, update?: () => void): T {
  if (!target['$$proxyGetters']) {
    Object.defineProperty(target, '$$proxyGetters', { value: {} })
  }

  const diff = {}
  const getters = target['$$proxyGetters']
  if (!update) defineProperty(target, '$diff', diff)

  const proxy = new Proxy(target as Observed<T>, {
    get(target, key) {
      if (key in getters) return getters[key]
      const value = target[key]
      if (!value || staticTypes.includes(typeof value) || typeof key === 'string' && key.startsWith('$')) return value
      const $update = update || (() => {
        const hasKey = key in diff
        diff[key] = getters[key]
        if (!hasKey && label) {
          logger.debug(`[diff] ${label}: ${String(key)} (deep)`)
        }
      })
      return observeProperty(value, getters, key, label, $update)
    },
    set(target, key, value) {
      if (target[key] !== value && (typeof key !== 'string' || !key.startsWith('$'))) {
        if (update) {
          update()
        } else {
          const hasKey = key in diff
          diff[key] = value
          delete getters[key]
          if (!hasKey && label) {
            logger.debug(`[diff] ${label}: ${String(key)}`)
          }
        }
      }
      return Reflect.set(target, key, value)
    },
    deleteProperty(target, key) {
      if (update) {
        update()
      } else {
        delete diff[key]
        delete getters[key]
      }
      return Reflect.deleteProperty(target, key)
    },
  })

  return proxy
}

const arrayProxyMethods = ['pop', 'shift', 'splice', 'sort']

function observeArray<T>(target: T[], label: string, update: () => void) {
  const proxy: Record<number, T> = {}

  for (const method of arrayProxyMethods) {
    defineProperty(target, method, function (...args: any[]) {
      update()
      return Array.prototype[method].apply(this, args)
    })
  }

  return new Proxy(target, {
    get(target, key) {
      if (key in proxy) return proxy[key]
      const value = target[key]
      if (!value || staticTypes.includes(typeof value) || typeof key === 'symbol' || isNaN(key as any)) return value
      return observeProperty(value, proxy, key, label, update)
    },
    set(target, key, value) {
      if (typeof key !== 'symbol' && !isNaN(key as any) && target[key] !== value) update()
      return Reflect.set(target, key, value)
    },
  })
}

function observeDate(target: Date, update: () => void) {
  for (const method of Object.getOwnPropertyNames(Date.prototype)) {
    if (method === 'valueOf') continue
    defineProperty(target, method, function (...args: any[]) {
      const oldValue = target.valueOf()
      const result = Date.prototype[method].apply(this, args)
      if (target.valueOf() !== oldValue) update()
      return result
    })
  }
  return target
}

export type Observed<T, R = any> = T & {
  $diff: Partial<T>
  $update: () => R
  $merge: (value: Partial<T>) => Observed<T, R>
}

type UpdateFunction<T, R> = (diff: Partial<T>) => R

export function observe<T extends object>(target: T, label?: string | number): Observed<T, void>
export function observe<T extends object, R>(target: T, update: UpdateFunction<T, R>, label?: string | number): Observed<T, R>
export function observe<T extends object, R>(target: T, ...args: [(string | number)?] | [UpdateFunction<T, R>, (string | number)?]) {
  if (staticTypes.includes(typeof target)) {
    throw new Error(`cannot observe immutable type "${typeof target}"`)
  } else if (!target) {
    throw new Error('cannot observe null or undefined')
  }

  const type = Object.prototype.toString.call(target).slice(8, -1)
  if (builtinClasses.includes(type)) {
    throw new Error(`cannot observe instance of type "${type}"`)
  }

  let label = '', update: UpdateFunction<T, R> = noop
  if (typeof args[0] === 'function') update = args.shift() as any
  if (typeof args[0] === 'string') label = args[0]

  const observer = observeObject(target, label, null) as Observed<T>

  defineProperty(observer, '$update', function $update(this: Observed<T>) {
    const diff = { ...this.$diff }
    const fields = Object.keys(diff)
    if (fields.length) {
      if (label) logger.debug(`[update] ${label}: ${fields.join(', ')}`)
      for (const key in this.$diff) {
        delete this.$diff[key]
      }
      return update(diff)
    }
  })

  defineProperty(observer, '$merge', function $merge(this: Observed<T>, value: Partial<T>) {
    for (const key in value) {
      if (key in this.$diff) {
        throw new Error(`unresolved diff key "${key}"`)
      }
      target[key] = value[key]
      delete this['$$proxyGetters'][key]
    }
    return this
  })

  return observer
}
