// modified from vm2@3.9.2
// https://github.com/patriksimek/vm2

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { Script, createContext } from 'vm'
import { EventEmitter } from 'events'
import { INSPECT_MAX_BYTES } from 'buffer'
import { inspect } from 'util'
import type * as Internal from './internal'

export interface VMOptions {
  sandbox?: any
  strings?: boolean
  wasm?: boolean
}

export class VM extends EventEmitter {
  readonly _context: object
  readonly _internal: typeof Internal = Object.create(null)

  constructor (options: VMOptions = {}) {
    super()

    const { sandbox = {}, strings = true, wasm = true } = options
    this._context = createContext(undefined, {
      codeGeneration: { strings, wasm },
    })

    const filename = resolve(__dirname, 'internal.js')
    const data = readFileSync(filename, 'utf8')
    const script = new Script(`(function(host, exports) {${data}\n})`, {
      filename,
      displayErrors: false,
    })

    script
      .runInContext(this._context, { displayErrors: false })
      .call(this._context, Host, this._internal)

    for (const name in sandbox) {
      if (Object.prototype.hasOwnProperty.call(sandbox, name)) {
        this._internal.setGlobal(name, sandbox[name])
      }
    }
  }

  get sandbox () {
    return this._internal.sandbox
  }

  setGlobal (name: string, value: any) {
    this._internal.setGlobal(name, value, true)
    return this
  }

  getGlobal (name: string) {
    return this._internal.getGlobal(name)
  }

  freeze (value: any, globalName?: string) {
    this._internal.readonly(value)
    if (globalName) this._internal.setGlobal(globalName, value)
    return value
  }

  protect (value: any, globalName?: string) {
    this._internal.protect(value)
    if (globalName) this._internal.setGlobal(globalName, value)
    return value
  }

  run (code: string, filename = 'vm.js') {
    const script = new Script(code, {
      filename,
      displayErrors: false,
    })

    try {
      return this._internal.value(script.runInContext(this._context, { displayErrors: false }))
    } catch (e) {
      throw this._internal.value(e)
    }
  }
}

export class VMError extends Error {
  name = 'VMError'

  constructor (message: string) {
    super(message)
    Error.captureStackTrace(this, this.constructor)
  }
}

export const Host = {
  String,
  Number,
  Buffer,
  Boolean,
  Array,
  Date,
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  RegExp,
  Function,
  Object,
  VMError,
  Proxy,
  Reflect,
  Map,
  WeakMap,
  Set,
  WeakSet,
  Promise,
  inspectCustom: inspect.custom,
  Symbol,
  INSPECT_MAX_BYTES,
} as const
