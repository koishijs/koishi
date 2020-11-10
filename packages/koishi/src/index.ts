export * from 'koishi-core'
export * from 'koishi-utils'
export type { AppConfig, PluginConfig } from './worker'

const _require = module.require
const { version } = _require('../package')
export { version }
