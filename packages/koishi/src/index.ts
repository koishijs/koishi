export * from 'koishi-core'
export type { AppConfig, PluginConfig } from './worker'

declare const KOISHI_VERSION: string
export const version = KOISHI_VERSION
