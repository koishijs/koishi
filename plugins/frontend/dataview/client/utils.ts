import { Query } from 'koishi'
import { send } from '~/client'

import { DbEvents } from '../src/index'
import { ElMessage } from 'element-plus'

export class KoishiError extends Error {
  name = 'KoishiError'

  constructor(message: string, public code: KoishiError.Code) {
    super(message)
  }

  static check(error: any, code?: KoishiError.Code) {
    if (!(error instanceof KoishiError)) return false
    return !code || error.code === code
  }
}

export namespace KoishiError {
  export type Code =
    | 'runtime.max-depth-exceeded'
    | 'database.duplicate-entry'
    | 'model.missing-field-definition'
    | 'model.invalid-field-definition'
    | 'model.invalid-query'
}

export function formatSize(size: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  for (const idx in units) {
    if (idx && size > 1024) { size /= 1024 } else { return `${size.toFixed(1)} ${units[idx]}` }
  }
  return `${size.toFixed(1)} ${units[units.length - 1]}`
}
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never
export type AwaitedDbEventsReturns = {
  [T in keyof DbEvents]: Awaited<ReturnType<DbEvents[T]>>
}

export function sendFallible<T extends keyof Query.Methods>(
  type: `dataview/db-${T}`,
  ...args: Parameters<Query.Methods[T]>
): Promise<ReturnType<Query.Methods[T]>> {
  return send(type, ...args).then((res: AwaitedDbEventsReturns[`dataview/db-${T}`]) => {
    if (res.ok !== false) {
      return res.success as any
    }
    if (res.failed.name === KoishiError.name && 'code' in res.failed) {
      const backendError = res.failed as KoishiError
      const error = new KoishiError(backendError.message || backendError.code, backendError.code)
      error.stack += '\n' + backendError.stack
      throw error
    }
    throw res.failed
  })
}

export function handleError(e: Error, msg: string = '') {
  console.warn(e)
  if (!msg.length) msg += '：'
  if (e instanceof KoishiError) msg += e.code
  else msg += e.name
  return ElMessage.error(msg)
}
