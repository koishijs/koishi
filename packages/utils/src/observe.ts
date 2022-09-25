import { defineProperty, is, noop } from 'cosmokit'

const immutable = ['number', 'string', 'bigint', 'boolean', 'symbol', 'function']
const builtin = ['Date', 'RegExp', 'Set', 'Map', 'WeakSet', 'WeakMap', 'Array']

function observeProperty(value: any, update: any) {
  if (is('Date', value)) {
    return observeDate(value, update)
  } else if (Array.isArray(value)) {
    return observeArray(value, update)
  } else {
    return observeObject(value, update)
  }
}

function untracked(key: string | symbol) {
  return typeof key === 'symbol' || key.startsWith('$')
}

function observeObject<T extends object>(target: T, notify?: (key: string | symbol) => void): T {
  const update = notify
  if (!notify) {
    const diff = Object.create(null)
    defineProperty(target, '$diff', diff)
    notify = (key) => {
      if (untracked(key)) return
      diff[key] = target[key]
    }
  }

  const proxy = new Proxy(target as Observed<T>, {
    get(target, key) {
      const value = Reflect.get(target, key)
      if (!value || immutable.includes(typeof value) || untracked(key)) return value
      return observeProperty(value, update || (() => notify(key)))
    },
    set(target, key, value) {
      const unchanged = target[key] === value
      const result = Reflect.set(target, key, value)
      if (unchanged || !result) return result
      notify(key)
      return true
    },
    deleteProperty(target, key) {
      const unchanged = !(key in target)
      const result = Reflect.deleteProperty(target, key)
      if (unchanged || !result) return result
      notify(key)
      return true
    },
  })

  return proxy
}

const arrayProxyMethods = ['pop', 'shift', 'splice', 'sort']

function observeArray<T>(target: T[], update: () => void) {
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
      if (!value || immutable.includes(typeof value) || typeof key === 'symbol' || isNaN(key as any)) return value
      return observeProperty(value, update)
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
  if (immutable.includes(typeof target)) {
    throw new Error(`cannot observe immutable type "${typeof target}"`)
  } else if (!target) {
    throw new Error('cannot observe null or undefined')
  }

  const type = Object.prototype.toString.call(target).slice(8, -1)
  if (builtin.includes(type)) {
    throw new Error(`cannot observe instance of type "${type}"`)
  }

  let update: UpdateFunction<T, R> = noop
  if (typeof args[0] === 'function') update = args.shift() as any

  const observer = observeObject(target, null) as Observed<T>

  defineProperty(observer, '$update', function $update(this: Observed<T>) {
    const diff = { ...this.$diff }
    const fields = Object.keys(diff)
    if (fields.length) {
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
    }
    return this
  })

  return observer
}
