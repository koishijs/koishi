import debug from 'debug'
import { types } from 'util'
import { noop } from './misc'

const showObserverLog = debug('koishi:observer')
const staticTypes = ['number', 'string', 'bigint', 'boolean', 'symbol', 'function']
const builtinClasses = ['Date', 'RegExp', 'Set', 'Map', 'WeakSet', 'WeakMap', 'Array']

export function pick <T, K extends keyof T> (source: T, keys: Iterable<K>) {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = source[key]
  }
  return result
}

export function defineProperty <T, K extends keyof T> (object: T, key: K, value: T[K]): void
export function defineProperty <T, K extends keyof any> (object: T, key: K, value: any): void
export function defineProperty <T, K extends keyof any> (object: T, key: K, value: any) {
  Object.defineProperty(object, key, { writable: true, value })
}

function observeProperty (value: any, proxy: any, key: any, label: string, update: any) {
  if (types.isDate(value)) {
    return proxy[key] = observeDate(value, update)
  } else if (Array.isArray(value)) {
    return proxy[key] = observeArray(value, label, update)
  } else {
    return proxy[key] = observeObject(value, label, update)
  }
}

function observeObject <T extends object> (target: T, label: string, update?: () => void): T {
  if (!target['__proxyGetters__']) {
    Object.defineProperty(target, '__proxyGetters__', { value: {} })
  }

  const diff = {}
  const getters = target['__proxyGetters__']
  if (!update) defineProperty(target, '_diff', diff)

  const proxy = new Proxy(target as Observed<T>, {
    get (target, key) {
      if (key in getters) return getters[key]
      const value = target[key]
      if (!value || staticTypes.includes(typeof value) || typeof key === 'string' && key.startsWith('_')) return value
      const _update = update || (() => {
        const hasKey = key in diff
        diff[key] = getters[key]
        if (!hasKey && label) {
          showObserverLog(`[diff] ${label}: ${String(key)} (deep)`)
        }
      })
      return observeProperty(value, getters, key, label, _update)
    },
    set (target, key, value) {
      if (target[key] !== value && (typeof key !== 'string' || !key.startsWith('_'))) {
        if (update) {
          update()
        } else {
          const hasKey = key in diff
          diff[key] = value
          delete getters[key]
          if (!hasKey && label) {
            showObserverLog(`[diff] ${label}: ${String(key)}`)
          }
        }
      }
      return Reflect.set(target, key, value)
    },
    deleteProperty (target, key) {
      if (update) {
        update()
      } else {
        delete diff[key]
      }
      return Reflect.deleteProperty(target, key)
    },
  })

  return proxy
}

const arrayProxyMethods = ['pop', 'shift', 'splice', 'sort']

function observeArray <T> (target: T[], label: string, update: () => void) {
  const proxy: Record<number, T> = {}

  for (const method of arrayProxyMethods) {
    defineProperty(target, method, function (...args: any[]) {
      update()
      return Array.prototype[method].apply(this, args)
    })
  }

  return new Proxy(target, {
    get (target, key) {
      if (key in proxy) return proxy[key]
      const value = target[key]
      if (!value || staticTypes.includes(typeof value) || typeof key === 'symbol' || isNaN(key as any)) return value
      return observeProperty(value, proxy, key, label, update)
    },
    set (target, key, value) {
      if (typeof key !== 'symbol' && !isNaN(key as any) && target[key] !== value) update()
      return Reflect.set(target, key, value)
    },
  })
}

function observeDate (target: Date, update: () => void) {
  for (const method in Date.prototype) {
    defineProperty(target, method, function (...args: any[]) {
      const oldValue = target.valueOf()
      const result = Date.prototype[method].apply(this, args)
      if (target.valueOf() !== oldValue) update()
      return result
    })
  }
  return target
}

export type Observed <T, R = any> = T & {
  _diff: Partial<T>
  _update: () => R
  _merge: (value: Partial<T>) => Observed<T>
}

type UpdateFunction <T, R> = (diff: Partial<T>) => R

export function observe <T extends object> (target: T, label?: string | number): Observed<T, void>
export function observe <T extends object, R> (target: T, update: UpdateFunction<T, R>, label?: string | number): Observed<T, R>
export function observe <T extends object, R> (target: T, ...args: [(string | number)?] | [UpdateFunction<T, R>, (string | number)?]) {
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

  defineProperty(observer, '_update', function (this: Observed<T>) {
    const diff = { ...this._diff }
    const fields = Object.keys(diff)
    if (fields.length) {
      if (label) showObserverLog(`[update] ${label}: ${fields.join(', ')}`)
      for (const key in this._diff) {
        delete this._diff[key]
      }
      return update(diff)
    }
  })

  defineProperty(observer, '_merge', function (this: Observed<T>, value: Partial<T>) {
    for (const key in value) {
      if (key in this._diff) {
        throw new Error(`unresolved diff key "${key}"`)
      }
      target[key] = value[key]
      delete this['__proxyGetters__'][key]
    }
    return this
  })

  return observer
}
