import { resolve } from 'path'

function getCallerPath () {
  const prepareStackTrace = Error.prepareStackTrace
  Error.prepareStackTrace = (_, stack) => stack
  const callsites = new Error().stack.slice(1) as any
  Error.prepareStackTrace = prepareStackTrace

  const callers: NodeJS.CallSite[] = []
  const callerFileSet = new Set()
  for (const callsite of callsites) {
    const fileName = callsite.getFileName()
    if (!callerFileSet.has(fileName)) {
      callerFileSet.add(fileName)
      callers.unshift(callsite)
    }

    const hasReceiver = callsite.getTypeName() !== null && fileName !== null
    if (hasReceiver) return callers[0].getFileName()
  }
}

const ACTUAL_MARKER = Symbol('actual-module')

export function mockModule(path: string, factory: (module: any) => any) {
  path = require.resolve(resolve(getCallerPath(), path))
  let module = require(path)
  if (ACTUAL_MARKER in module) {
    module = module[ACTUAL_MARKER]
  }
  require.cache[path] = factory(module)
  require.cache[path][ACTUAL_MARKER] = module
}

export function actualModule(path: string) {
  path = require.resolve(resolve(getCallerPath(), path))
  if (require.cache[path]?.[ACTUAL_MARKER]) {
    return require.cache[path][ACTUAL_MARKER]
  } else {
    return require(path)
  }
}

export function unmockModule(path: string) {
  path = require.resolve(resolve(getCallerPath(), path))
  if (require.cache[path]?.[ACTUAL_MARKER]) {
    require.cache[path] = require.cache[path][ACTUAL_MARKER]
  }
}
