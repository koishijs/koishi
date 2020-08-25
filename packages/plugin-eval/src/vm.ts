// modified from vm2@3.9.2
// https://github.com/patriksimek/vm2

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { Script, createContext, ScriptOptions } from 'vm'
import { INSPECT_MAX_BYTES } from 'buffer'
import { inspect } from 'util'
import { Logger } from 'koishi-utils'
import * as Internal from './internal'

export interface VMOptions {
  strings?: boolean
  wasm?: boolean
}

export class VM {
  readonly context: object
  readonly internal: typeof Internal = Object.create(null)

  constructor(options: VMOptions = {}) {
    const { strings = true, wasm = true } = options
    this.context = createContext(undefined, {
      codeGeneration: { strings, wasm },
    })

    const filename = resolve(__dirname, '../dist/internal.js')
    const data = readFileSync(filename, 'utf8')
    const script = new Script(data, {
      filename,
    })

    script
      .runInContext(this.context, { displayErrors: false })
      .call(this.context, Host, this.internal)
  }

  run(code: string, options: ScriptOptions = {}) {
    const script = new Script(code, options)

    try {
      return this.internal.value(script.runInContext(this.context, { displayErrors: false }))
    } catch (e) {
      throw this.internal.value(e)
    }
  }
}

export class VMError extends Error {
  name = 'VMError'

  constructor(message: string) {
    super(message)
    Error.captureStackTrace(this, this.constructor)
  }
}

const { debug } = new Logger('eval')

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
