// modified from vm2@3.9.2
// https://github.com/patriksimek/vm2

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { Script, createContext } from 'vm'
import { INSPECT_MAX_BYTES } from 'buffer'
import { inspect } from 'util'
import { Logger } from 'koishi-utils'
import type * as Internal from './internal'

export interface VMOptions {
  strings?: boolean
  wasm?: boolean
}

export class VM {
  readonly context: object
  readonly internal: typeof Internal = Object.create(null)

  constructor (options: VMOptions = {}) {
    const { strings = true, wasm = true } = options
    this.context = createContext(undefined, {
      codeGeneration: { strings, wasm },
    })

    const filename = resolve(__dirname, 'internal.js')
    const data = readFileSync(filename, 'utf8')
    const script = new Script(`(function(host, exports) {${data}\n})`, {
      filename,
      displayErrors: false,
    })

    script
      .runInContext(this.context, { displayErrors: false })
      .call(this.context, Host, this.internal)
  }

  run (code: string, filename = 'vm.js') {
    const script = new Script(code, {
      filename,
      displayErrors: false,
    })

    try {
      return this.internal.value(script.runInContext(this.context, { displayErrors: false }))
    } catch (e) {
      throw this.internal.value(e)
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

const { debug } = Logger.create('eval')

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
  debug,
  TextEncoder,
  TextDecoder,
  inspect,
  Symbol,
  INSPECT_MAX_BYTES,
} as const
