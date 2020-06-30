import debug from 'debug'
import { types } from 'util'
import { noop } from './misc'

const showObserverLog = debug('koishi:observer')
const staticTypes = ['number', 'string', 'bigint', 'boolean', 'symbol', 'function']
const builtinClasses = ['Date', 'RegExp', 'Set', 'Map', 'WeakSet', 'WeakMap', 'Array']

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

  if (!update) {
    Object.defineProperty(target, '_diff', { value: {}, writable: true })
  }

  return new Proxy(target as Observed<T, any>, {
    get (target, key) {
      if (key in target.__proxyGetters__) return target.__proxyGetters__[key]
      const value = target[key]
      if (!value || staticTypes.includes(typeof value) || typeof key === 'string' && key.startsWith('_')) return value
      const _update = update || (() => {
        const hasKey = key in target._diff
        target._diff[key] = target.__proxyGetters__[key]
        if (!hasKey && label) {
          showObserverLog(`[diff] ${label}: ${String(key)} (deep)`)
        }
      })
      return observeProperty(value, target.__proxyGetters__, key, label, _update)
    },
    set (target, key, value) {
      if (target[key] !== value) {
        if (update) {
          update()
        } else if (typeof key !== 'string' || !key.startsWith('_')) {
          const hasKey = key in target._diff
          target._diff[key] = value
          delete target.__proxyGetters__[key]
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
        delete target._diff[key]
      }
      return Reflect.deleteProperty(target, key)
    },
  })
}

const arrayProxyMethods = ['pop', 'shift', 'splice']

function observeArray <T> (target: T[], label: string, update: () => void) {
  const proxy: Record<number, T> = {}

  for (const method of arrayProxyMethods) {
    Object.defineProperty(target, method, {
      writable: true,
      value (...args: any[]) {
        update()
        return Array.prototype[method].apply(this, args)
      },
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
    if (!method.startsWith('set')) continue
    Object.defineProperty(target, method, {
      writable: true,
      value (...args: any[]) {
        update()
        return Array.prototype[method].apply(this, args)
      },
    })
  }

  return target
}

export type Observed <T, R = any> = T & {
  _diff: Partial<T>
  _update: () => R
  _merge: (value: Partial<T>) => Observed<T, R>
  __proxyGetters__: Partial<T>
  __updateCallback__: UpdateFunction<T, R>
}

type UpdateFunction <T, R> = (diff: Partial<T>) => R

export function observe <T extends object> (target: T, label?: string | number): Observed<T, void>
export function observe <T extends object, R> (target: T, update: UpdateFunction<T, R>, label?: string | number): Observed<T, R>
export function observe <T extends object, R> (target: T, ...args: [(string | number)?] | [UpdateFunction<T, R>, (string | number)?]) {
  if (staticTypes.includes(typeof target)) {
    throw new Error(`cannot observe type "${typeof target}"`)
  } else if (!target) {
    throw new Error('cannot observe null or undefined')
  } else {
    const type = Object.prototype.toString.call(target).slice(8, -1)
    if (builtinClasses.includes(type)) {
      throw new Error(`cannot observe instance of type "${type}"`)
    }
  }

  let label = '', update: UpdateFunction<T, R>
  if (typeof args[0] === 'function') update = args.shift() as UpdateFunction<T, R>
  if (typeof args[0] === 'string') label = args[0]

  Object.defineProperty(target, '__updateCallback__', { value: update || noop, writable: true })

  Object.defineProperty(target, '_update', {
    writable: true,
    value (this: Observed<T, R>) {
      const diff = this._diff
      const fields = Object.keys(diff)
      if (fields.length) {
        if (label) showObserverLog(`[update] ${label}: ${fields.join(', ')}`)
        this._diff = {}
        return this.__updateCallback__(diff)
      }
    },
  })

  Object.defineProperty(target, '_merge', {
    writable: true,
    value (this: Observed<T, R>, value: Partial<T>) {
      for (const key in value) {
        if (!(key in this._diff)) {
          target[key] = value[key]
          delete this.__proxyGetters__[key]
        }
      }
      return this
    },
  })

  const observer = observeObject(target, label, null) as Observed<T, R>
  return observer
}
