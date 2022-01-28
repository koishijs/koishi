import { App } from 'koishi'

export * from 'koishi'

export type * from './lib/addons'
export type * from './lib/loader'
export type * from './lib/worker'

export function defineConfig(config: App.Config): App.Config
