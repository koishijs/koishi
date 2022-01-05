import Schema from 'schemastery'

export { Schema }

export * from '@koishijs/utils'
export * from './adapter'
export * from './app'
export * from './bot'
export * from './command'
export * from './context'
export * from './database'
export * from './error'
export * from './orm'
export * from './parser'
export * from './session'
export * from './internal'

declare const KOISHI_VERSION: string
export const version = KOISHI_VERSION
