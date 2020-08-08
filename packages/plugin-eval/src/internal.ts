// modified from vm2@3.9.2
// https://github.com/patriksimek/vm2

/* eslint-disable */

import type { Host } from './vm'
import { InspectOptions } from 'util'

declare global {
  const host: typeof Host
}

const GLOBAL: any = this

interface Builtin {
  // built-in classes
  Object: typeof Object
  Array: typeof Array
  String: typeof String
  Number: typeof Number
  Boolean: typeof Boolean
  Function: typeof Function
  Date: typeof Date
  Error: typeof Error
  RangeError: typeof RangeError
  SyntaxError: typeof SyntaxError
  TypeError: typeof TypeError
  URIError: typeof URIError
  EvalError: typeof EvalError
  ReferenceError: typeof ReferenceError
  Promise: typeof Promise
  RegExp: typeof RegExp
  Map: typeof Map
  Set: typeof Set
  WeakMap: typeof WeakMap
  WeakSet: typeof WeakSet

  // mocked classes
  Buffer: typeof Buffer
  VMError: typeof VMError

  // builtin utils
  Reflect: typeof Reflect
  Symbol: typeof Symbol
  inspectCustom: symbol
}

type Trap = ProxyHandler<any>
function createObject <T> (...traps: T[]): T {
  return host.Object.assign(host.Object.create(null), ...traps)
}

const local: Builtin = host.Object.create(null)
local.Object = Object
local.Array = Array
local.String = String
local.Number = Number
local.Boolean = Boolean
local.Function = Function
local.Date = Date
local.RangeError = RangeError
local.ReferenceError = ReferenceError
local.SyntaxError = SyntaxError
local.TypeError = TypeError
local.EvalError = EvalError
local.URIError = URIError
local.Error = Error
local.RegExp = RegExp
local.Map = Map
local.WeakMap = WeakMap
local.Set = Set
local.WeakSet = WeakSet
local.Promise = Promise

local.Symbol = Symbol
local.inspectCustom = host.inspectCustom
local.Reflect = host.Object.create(null)
for (const key of host.Object.getOwnPropertyNames(Reflect)) {
  local.Reflect[key] = Reflect[key]
}

Object.setPrototypeOf(GLOBAL, Object.prototype)

Object.defineProperties(GLOBAL, {
  global: { value: GLOBAL },
  GLOBAL: { value: GLOBAL },
  isVM: { value: true },
})

const DEBUG = false
const OPNA = 'Operation not allowed on contextified object.'
const captureStackTrace = Error.captureStackTrace

// Map of contextified objects to original objects
const Contextified = new host.WeakMap()
const Decontextified = new host.WeakMap()

// We can't use host's hasInstance method
const hasInstance = local.Object[Symbol.hasInstance]
function instanceOf(value, construct) {
  try {
    return host.Reflect.apply(hasInstance, construct, [value])
  } catch (ex) {
    // Never pass the handled exception through!
    throw new VMError('Unable to perform instanceOf check.')
    // This exception actually never get to the user. It only instructs the caller to return null because we wasn't able to perform instanceOf check.
  }
}

const SHARED_OBJECT = {__proto__: null}

function createBaseObject(obj: any) {
  let base: any
  if (typeof obj === 'function') {
    try {
      new new host.Proxy(obj, {
        // @ts-ignore
        __proto__: null,
        construct() {
          return this
        }
      })()
      base = function() {}
      base.prototype = null
    } catch (e) {
      base = () => {}
    }
  } else if (host.Array.isArray(obj)) {
    base = []
  } else {
    return {__proto__: null}
  }
  if (!local.Reflect.setPrototypeOf(base, null)) {
    // Should not happen
    return null
  }
  return base
}

/**
 * VMError definition.
 */

class VMError extends Error {
  name = 'VMError'

  constructor(message: string, public code?: number) {
    super(message)
    captureStackTrace(this, this.constructor)
  }
}

Object.defineProperty(GLOBAL, 'VMError', {
  value: VMError,
})

local.VMError = VMError

/*
 * This function will throw a TypeError for accessing properties
 * on a strict mode function
 */
function throwCallerCalleeArgumentsAccess(key) {
  'use strict'
  throwCallerCalleeArgumentsAccess[key] // lgtm[js/useless-expression]
  return new VMError('Unreachable')
}

function unexpected() {
  throw new VMError('Should not happen')
}

function doPreventExtensions(target, object, doProxy) {
  const keys = local.Reflect.ownKeys(object)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    let desc = local.Reflect.getOwnPropertyDescriptor(object, key)
    if (!desc) continue
    if (!local.Reflect.setPrototypeOf(desc, null)) unexpected()
    if (!desc.configurable) {
      const current = local.Reflect.getOwnPropertyDescriptor(target, key)
      if (current && !current.configurable) continue
      if (desc.get || desc.set) {
        desc.get = doProxy(desc.get)
        desc.set = doProxy(desc.set)
      } else {
        desc.value = doProxy(desc.value)
      }
    } else {
      if (desc.get || desc.set) {
        desc = {
          // @ts-ignore
          __proto__: null,
          configurable: true,
          enumerable: desc.enumerable,
          writable: true,
          value: null
        }
      } else {
        desc.value = null
      }
    }
    if (!local.Reflect.defineProperty(target, key, desc)) unexpected()
  }
  if (!local.Reflect.preventExtensions(target)) unexpected()
}

type Inspector <T> = (helper: Helper, toStringTag: string) => (this: T, depth: number, options: InspectOptions) => string

interface Helper {
  conjugate: Helper
  remote: Builtin
  local: Builtin
  remoteStore: WeakMap<object, any>
  localStore: WeakMap<object, any>
  proxies: WeakMap<object, any>
  arguments: (args: any[]) => any[]
  instance <T> (instance: any, klass: new (...args: any[]) => T, deepTraps: Trap, flags, toStringTag?: string, inspectCustom?: Inspector<T>): any
  function: (fnc, traps?: Trap, deepTraps?: Trap, flags?, mock?) => any
  object: (object, traps: Trap, deepTraps: Trap, flags?, mock?) => any
  value: (value, traps?: Trap, deepTraps?: Trap, flags?, mock?) => any
}

const Helper: Helper = Object.create(null)

Helper.arguments = function (this: Helper, args) {
  // TODO wield behavior, not modified
  if (!host.Array.isArray(args)) return new this.local.Array()

  try {
    const arr = new this.local.Array()
    for (let i = 0, l = args.length; i < l; i++) {
      arr[i] = this.value(args[i])
    }
    return arr
  } catch (e) {
    return new this.local.Array()
  }
}

Helper.instance = function (this: Helper, instance, klass, deepTraps, flags, toStringTag, inspectCustom) {
  if (typeof instance === 'function') return this.function(instance)
  return this.object(instance, createObject({
    get: (target, key) => {
      try {
        if (key === 'vmProxyTarget' && DEBUG) return instance
        if (key === 'isVMProxy') return true
        if (key === 'constructor') return klass
        if (key === '__proto__') return klass.prototype
      } catch (e) {
        return null
      }

      if (key === '__defineGetter__') return this.local.Object.prototype['__defineGetter__']
      if (key === '__defineSetter__') return this.local.Object.prototype['__defineSetter__']
      if (key === '__lookupGetter__') return this.local.Object.prototype['__lookupGetter__']
      if (key === '__lookupSetter__') return this.local.Object.prototype['__lookupSetter__']
      if (key === this.local.Symbol.toStringTag && toStringTag) return toStringTag
      if (key === this.local.inspectCustom && inspectCustom) return inspectCustom(this, toStringTag)

      try {
        return this.value(this.remote.Reflect.get(instance, key), null, deepTraps, flags)
      } catch (e) {
        throw this.value(e)
      }
    },
    getPrototypeOf: () => {
      return klass && klass.prototype
    },
  }), deepTraps, flags)
}

Helper.function = function (this: Helper, fnc, traps, deepTraps, flags, mock) {
  const proxy = this.object(fnc, createObject({
    apply: (target, context, args) => {
      context = this.conjugate.value(context)
      args = this.conjugate.arguments(args)
      try {
        return this.value(fnc.apply(context, args))
      } catch (e) {
        throw this.value(e)
      }
    },
    construct: (target, args) => {
      args = this.conjugate.arguments(args)
      try {
        return this.instance(new fnc(...args), proxy, deepTraps, flags)
      } catch (e) {
        throw this.value(e)
      }
    },
    get: (target, key) => {
      try {
        if (key === 'vmProxyTarget' && DEBUG) return fnc
        if (key === 'isVMProxy') return true
        if (mock && host.Object.prototype.hasOwnProperty.call(mock, key)) return mock[key]
        if (key === 'constructor') return this.local.Function
        if (key === '__proto__') return this.local.Function.prototype
      } catch (e) {
        // Never pass the handled expcetion through! This block can't throw an exception under normal conditions.
        return null
      }
  
      if (key === '__defineGetter__') return this.local.Object.prototype['__defineGetter__']
      if (key === '__defineSetter__') return this.local.Object.prototype['__defineSetter__']
      if (key === '__lookupGetter__') return this.local.Object.prototype['__lookupGetter__']
      if (key === '__lookupSetter__') return this.local.Object.prototype['__lookupSetter__']
      if (this === Contextify && (key === 'caller' || key === 'callee' || key === 'arguments')) {
        throw throwCallerCalleeArgumentsAccess(key)
      }

      try {
        return this.value(fnc[key], null, deepTraps, flags)
      } catch (e) {
        throw this.value(e)
      }
    },
    getPrototypeOf: () => this.local.Function.prototype,
  }, traps), deepTraps)
  return proxy
}

Helper.value = function (this: Helper, value, traps, deepTraps, flags, mock) {
  try {
    if (this.remoteStore.has(value)) return this.remoteStore.get(value)
    if (this.proxies.has(value)) return this.proxies.get(value)
    if (typeof value === 'function') return this.function(value, traps, deepTraps, flags, mock)
    if (typeof value === 'object') {
      if (value === null) return null
      if (instanceOf(value, this.remote.Number)) return this.instance(value, this.local.Number, deepTraps, flags, 'Number', primitiveInspector)
      if (instanceOf(value, this.remote.String)) return this.instance(value, this.local.String, deepTraps, flags, 'String', primitiveInspector)
      if (instanceOf(value, this.remote.Boolean)) return this.instance(value, this.local.Boolean, deepTraps, flags, 'Boolean', primitiveInspector)
      if (instanceOf(value, this.remote.Date)) return this.instance(value, this.local.Date, deepTraps, flags, 'Date', defaultInspector)
      if (instanceOf(value, this.remote.RangeError)) return this.instance(value, this.local.RangeError, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.ReferenceError)) return this.instance(value, this.local.ReferenceError, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.SyntaxError)) return this.instance(value, this.local.SyntaxError, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.TypeError)) return this.instance(value, this.local.TypeError, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.VMError)) return this.instance(value, this.local.VMError, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.EvalError)) return this.instance(value, this.local.EvalError, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.URIError)) return this.instance(value, this.local.URIError, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.Error)) return this.instance(value, this.local.Error, deepTraps, flags, 'Error', defaultInspector)
      if (instanceOf(value, this.remote.RegExp)) return this.instance(value, this.local.RegExp, deepTraps, flags, 'RegExp', defaultInspector)
      if (instanceOf(value, this.remote.Array)) return this.instance(value, this.local.Array, deepTraps, flags, 'Array')
      if (instanceOf(value, this.remote.Map)) return this.instance(value, this.local.Map, deepTraps, flags, 'Map')
      if (instanceOf(value, this.remote.WeakMap)) return this.instance(value, this.local.WeakMap, deepTraps, flags, 'WeakMap')
      if (instanceOf(value, this.remote.Set)) return this.instance(value, this.local.Set, deepTraps, flags, 'Set')
      if (instanceOf(value, this.remote.WeakSet)) return this.instance(value, this.local.WeakSet, deepTraps, flags, 'WeakSet')
      if (instanceOf(value, this.remote.Promise)) return this.instance(value, this.local.Promise, deepTraps, flags, 'Promise')
      // TODO different behavior with vm2, why?
      if (instanceOf(value, this.remote.Buffer)) return this.instance(value, this.local.Buffer, deepTraps, flags, 'Buffer')
      if (this.remote.Reflect.getPrototypeOf(value) === null) {
        return this.instance(value, null, deepTraps, flags)
      } else {
        return this.object(value, traps, deepTraps, flags, mock)
      }
    }
    return value
  } catch {
    return null
  }
}

Helper.object = function (this: Helper, object, traps, deepTraps, flags, mock) {
  const base: Trap = createObject({
    get: (target, key, receiver) => {
      try {
        if (key === 'vmProxyTarget' && DEBUG) return object
        if (key === 'isVMProxy') return true
        if (mock && host.Object.prototype.hasOwnProperty.call(mock, key)) return mock[key]
        if (key === 'constructor') return this.local.Object
        if (key === '__proto__') return this.local.Object.prototype
      } catch (e) {
        return null
      }

      if (key === '__defineGetter__') return this.local.Object.prototype['__defineGetter__']
      if (key === '__defineSetter__') return this.local.Object.prototype['__defineSetter__']
      if (key === '__lookupGetter__') return this.local.Object.prototype['__lookupGetter__']
      if (key === '__lookupSetter__') return this.local.Object.prototype['__lookupSetter__']

      try {
        return this.value(this.remote.Reflect.get(object, key), null, deepTraps, flags)
      } catch (e) {
        throw this.value(e)
      }
    },
    set: (target, key, value, receiver) => {
      if (this === Contextify) {
        if (key === '__proto__') return false
        if (flags && flags.protected && typeof value === 'function') return false
      }

      value = this.conjugate.value(value)
      try {
        return this.remote.Reflect.set(object, key, value)
      } catch (e) {
        throw this.value(e)
      }
    },
    getOwnPropertyDescriptor: (target, prop) => {
      let def: PropertyDescriptor
      try {
        def = host.Object.getOwnPropertyDescriptor(object, prop)
      } catch (e) {
        throw this.value(e)
      }
      // why?
      if (!def) return undefined

      const desc: PropertyDescriptor = createObject(def.get || def.set ? {
        get: this.value(def.get, null, deepTraps, flags) || undefined,
        set: this.value(def.set, null, deepTraps, flags) || undefined,
      } : {
        value: this.value(def.value, null, deepTraps, flags),
        writable: def.writable === true,
      })
      desc.enumerable = def.enumerable === true
      desc.configurable = def.configurable === true

      if (!desc.configurable) {
        try {
          def = host.Object.getOwnPropertyDescriptor(target, prop)
          if (!def || def.configurable || def.writable !== desc.writable) {
            local.Reflect.defineProperty(target, prop, desc)
          }
        } catch (e) {}
      }
      return desc
    },
    defineProperty: (target, key, descriptor) => {
      let success = false
      try {
        success = local.Reflect.setPrototypeOf(descriptor, null)
      } catch (e) {}
      if (!success) return false
  
      const descGet = descriptor.get
      const descSet = descriptor.set
      const descValue = descriptor.value
      if (this === Contextify && flags && flags.protected) {
        if (descGet || descSet || typeof descValue === 'function') return false
      }
  
      const propDesc: PropertyDescriptor = createObject(descGet || descSet ? {
        get: this.conjugate.value(descGet, null, deepTraps, flags) || undefined,
        set: this.conjugate.value(descSet, null, deepTraps, flags) || undefined,
      } : {
        value: this.conjugate.value(descValue, null, deepTraps, flags),
        writable: descriptor.writable === true,
      })
      propDesc.enumerable = descriptor.enumerable === true
      propDesc.configurable = descriptor.configurable === true

      try {
        success = this.remote.Reflect.defineProperty(object, key, propDesc)
      } catch (e) {
        throw this.value(e)
      }

      if (success && !descriptor.configurable) {
        try {
          local.Reflect.defineProperty(target, key, descriptor)
        } catch (e) {
          return false
        }
      }
      return success
    },
    deleteProperty: (target, prop) => {
      try {
        return this.value(this.remote.Reflect.deleteProperty(object, prop))
      } catch (e) {
        throw this.value(e)
      }
    },
    getPrototypeOf: (target) => {
      return this.local.Object.prototype
    },
    setPrototypeOf: (target) => {
      throw new VMError(OPNA)
    },
    has: (target, key) => {
      try {
        return this.value(this.remote.Reflect.has(object, key))
      } catch (e) {
        throw this.value(e)
      }
    },
    isExtensible: target => {
      let result: boolean
      try {
        // TODO symmetry
        result = this.remote.Reflect.isExtensible(object)
      } catch (e) {
        throw this.value(e)
      }
      if (result) return result

      try {
        if (local.Reflect.isExtensible(target)) {
          doPreventExtensions(target, object, obj => this.conjugate.value(obj, null, deepTraps, flags))
        }
      } catch (e) {}
    },
    ownKeys: target => {
      try {
        return this.value(this.remote.Reflect.ownKeys(object))
      } catch (e) {
        throw this.value(e)
      }
    },
    preventExtensions: target => {
      let success: boolean
      try {
        // TODO symmetry
        success = local.Reflect.preventExtensions(object)
      } catch (e) {
        throw this.value(e)
      }
      if (success) {
        try {
          if (local.Reflect.isExtensible(target)) {
            doPreventExtensions(target, object, obj => this.conjugate.value(obj, null, deepTraps, flags))
          }
        } catch (e) {}
      }
      return success
    },
    enumerate: target => {
      try {
        return this.value(this.remote.Reflect.enumerate(object))
      } catch (e) {
        throw this.value(e)
      }
    },
  }, traps, deepTraps)

  if (this === Contextify) {
    const proxy = new host.Proxy(createBaseObject(object), base)
    Contextify.proxies.set(object, proxy)
    Contextified.set(proxy, object)
    return proxy
  }

  let shallow
  if (host.Array.isArray(object)) {
    const origGet = base.get
    shallow = {
      __proto__: null,
      ownKeys: base.ownKeys,
      // TODO this get will call getOwnPropertyDescriptor of target all the time.
      get: origGet,
    }
    base.ownKeys = target => {
      try {
        const keys = local.Reflect.ownKeys(object)
        return Decontextify.value(keys.filter(key=>typeof key!=='string' || !key.match(/^\d+$/)))
      } catch (e) {
        throw Decontextify.value(e)
      }
    }
    base.get = (target, key, receiver) => {
      if (key === host.Symbol.toStringTag) return
      return origGet(target, key, receiver)
    }
  } else {
    shallow = SHARED_OBJECT
  }

  const proxy = new host.Proxy(createBaseObject(object), base)
  Decontextified.set(proxy, object)
  // We need two proxies since nodes inspect just removes one.
  const proxy2 = new host.Proxy(proxy, shallow)
  Decontextify.proxies.set(object, proxy2)
  Decontextified.set(proxy2, object)
  return proxy2
}

const Decontextify: Helper = host.Object.create(Helper)

Decontextify.local = host
Decontextify.remote = local
Decontextify.remoteStore = Contextified
Decontextify.localStore = Decontextified
Decontextify.proxies = new host.WeakMap()

const Contextify: Helper = host.Object.create(Helper)

Contextify.remote = host
Contextify.local = local
Contextify.remoteStore = Decontextified
Contextify.localStore = Contextified
Contextify.proxies = new host.WeakMap()

Contextify.conjugate = Decontextify
Decontextify.conjugate = Contextify

export function setGlobal (name: string, value: any, writable = false) {
  const prop = Contextify.value(name)
  try {
    Object.defineProperty(GLOBAL, prop, {
      value: Contextify.value(value),
      enumerable: true,
      writable,
    })
  } catch (e) {
    throw Decontextify.value(e)
  }
}

export function getGlobal (name: string) {
  const prop = Contextify.value(name)
  try {
    return Decontextify.value(GLOBAL[prop])
  } catch (e) {
    throw Decontextify.value(e)
  }
}

const FROZEN_TRAPS: Trap = createObject({
  set: () => false,
  setPrototypeOf: () => false,
  defineProperty: () => false,
  deleteProperty: () => false,
  isExtensible: () => false,
  preventExtensions: () => false,
})

export function readonly (value: any, mock?: any) {
  return Contextify.value(value, null, FROZEN_TRAPS, null, mock)
}

export function protect (value: any, mock?: any) {
  return Contextify.value(value, null, null, {protected: true}, mock)
}

function connect (outer: any, inner: any) {
  Decontextified.set(outer, inner)
  Contextified.set(inner, outer)
}

const BufferMock = createObject({
  allocUnsafe (size: number) {
    return this.alloc(size)
  },
  allocUnsafeSlow (size: number) {
    return this.alloc(size)
  },
})

Object.defineProperty(GLOBAL, 'Buffer', {
  value: readonly(host.Buffer, BufferMock),
})

local.Buffer = GLOBAL['Buffer']

connect(host.Buffer.prototype['inspect'], function inspect () {
  const max = host.INSPECT_MAX_BYTES
  const actualMax = Math.min(max, this.length)
  const remaining = this.length - max
  let str = this.hexSlice(0, actualMax).replace(/(.{2})/g, '$1 ').trim()
  if (remaining > 0) str += ` ... ${remaining} more byte${remaining > 1 ? 's' : ''}`
  return `<${this.constructor.name} ${str}>`
})

const defaultInspector: Inspector<Object> = (helper, toStringTag) => function (depth, options) {
  return this.toString()
}

const primitiveInspector: Inspector<Object> = (helper, toStringTag) => function (depth, options) {
  if (toStringTag === 'String') return `[String: '${this.toString()}']`
  return `[${toStringTag}: ${this.toString()}]`
}

export const value = Decontextify.value.bind(Decontextify)
export const sandbox = Decontextify.value(GLOBAL)

delete global.console

for (const key of Object.getOwnPropertyNames(global)) {
  Object.defineProperty(GLOBAL, key, { value: global[key] })
}
