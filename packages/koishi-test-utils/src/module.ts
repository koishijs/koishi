import { join, dirname } from 'path'

function getCallsites (): NodeJS.CallSite[] {
  const prepareStackTrace = Error.prepareStackTrace
  Error.prepareStackTrace = (_, stack) => stack
  const callsites = new Error().stack.slice(1) as any
  Error.prepareStackTrace = prepareStackTrace
  return callsites
}

const currentFile = getCallsites()[0].getFileName()

function getCallerPath () {
  for (const callsite of getCallsites()) {
    const file = callsite.getFileName()
    if (file && currentFile !== file) return file
  }
}

const ACTUAL_MARKER = Symbol('actual-module')

function resolvePath(path: string) {
  if (!path.startsWith('.')) {
    return require.resolve(path)
  }
  const base = dirname(getCallerPath())
  return require.resolve(join(base, path))
}

export function mockModule(path: string, factory: (exports: any) => any) {
  path = resolvePath(path)
  let exports = require(path)
  if (ACTUAL_MARKER in exports) {
    exports = exports[ACTUAL_MARKER]
  }
  const module = require.cache[path]
  module.exports = factory(exports)
  module.exports[ACTUAL_MARKER] = exports
}

export function actualModule(path: string) {
  path = resolvePath(path)
  const module = require.cache[path]
  if (module?.exports[ACTUAL_MARKER]) {
    return module.exports[ACTUAL_MARKER]
  } else {
    return require(path)
  }
}

export function unmockModule(path: string) {
  path = resolvePath(path)
  const module = require.cache[path]
  if (module?.exports[ACTUAL_MARKER]) {
    module.exports = module.exports[ACTUAL_MARKER]
  }
}
