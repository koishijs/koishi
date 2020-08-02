export * from 'koishi-core'
export * from 'koishi-utils'
export { AppConfig, PluginConfig } from './worker'

const version = require('../package').version as string
export { version }
