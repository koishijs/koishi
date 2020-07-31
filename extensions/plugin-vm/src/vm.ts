// modified from vm2@3.9.2
// https://github.com/patriksimek/vm2

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { Script, createContext } from 'vm'
import { EventEmitter } from 'events'
import { INSPECT_MAX_BYTES } from 'buffer'
import type * as Internal from './internal'

const timeoutContext = createContext()
const timeoutScript = new Script('fn()', {
  filename: 'timeout_bridge.js',
  displayErrors: false,
})

function doWithTimeout (fn: Function, timeout: number) {
	timeoutContext.fn = fn
	try {
		return timeoutScript.runInContext(timeoutContext, {
			displayErrors: false,
			timeout,
		})
	} finally {
		timeoutContext.fn = null
	}
}

const filename = resolve(__dirname, 'internal.js')
const data = readFileSync(filename, 'utf8')
const contextifyScript = new Script(`(function(host, exports) {${data}\n})`, {
  filename,
  displayErrors: false,
})

export interface VMOptions {
  sandbox: any
  timeout: number
  strings?: boolean
  wasm?: boolean
}

export class VM extends EventEmitter {
  readonly timeout: number
  readonly sandbox: object
  private readonly _context: object
  private readonly contextify: typeof Internal.Contextify
  private readonly decontextify: typeof Internal.Decontextify

	constructor(options: VMOptions) {
		super()

		const {	timeout, sandbox, strings = true, wasm = false } = options
		this._context = createContext(undefined, {
			codeGeneration: { strings, wasm },
    })

    console.log(2, Host)
    const internal: typeof Internal = Object.create(null)
    contextifyScript
      .runInContext(this._context, { displayErrors: false })
      .call(this._context, Host, internal)
    this.sandbox = internal.sandbox
    this.contextify = internal.Contextify
    this.decontextify = internal.Decontextify
    this.timeout = timeout
    this.setGlobals(sandbox)
	}

	setGlobals(values: object) {
		for (const name in values) {
			if (Object.prototype.hasOwnProperty.call(values, name)) {
				this.contextify.setGlobal(name, values[name])
			}
		}
		return this
	}

	setGlobal(name: string, value: any) {
		this.contextify.setGlobal(name, value)
		return this
	}

	getGlobal(name: string) {
		return this.contextify.getGlobal(name)
	}

	freeze(value: any, globalName?: string) {
		this.contextify.readonly(value)
		if (globalName) this.contextify.setGlobal(globalName, value)
		return value
	}

	protect(value: any, globalName?: string) {
		this.contextify.protected(value)
		if (globalName) this.contextify.setGlobal(globalName, value)
		return value
	}

	run (code: string, filename = 'vm.js') {
    const script = new Script(code, {
      filename,
      displayErrors: false,
    })

		return doWithTimeout(() => {
			try {
				return this.decontextify.value(script.runInContext(this._context, { displayErrors: false }))
			} catch (e) {
				throw this.decontextify.value(e)
			}
		}, this.timeout)
  }
}

export class VMError extends Error {
  name = 'VMError'

	constructor(message: string) {
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
	Symbol,
	INSPECT_MAX_BYTES,
} as const

console.log(1, Host)
