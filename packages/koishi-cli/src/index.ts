import * as commonPlugin from 'koishi-plugin-common'
import * as recorderPlugin from 'koishi-plugin-recorder'
import * as schedulePlugin from 'koishi-plugin-schedule'
import * as statusPlugin from 'koishi-plugin-status'
import * as teachPlugin from 'koishi-plugin-teach'
export { commonPlugin, recorderPlugin, schedulePlugin, statusPlugin, teachPlugin }

export * from 'koishi-core'
export * from 'koishi-utils'
export * from 'koishi-plugin-schedule/dist/utils'
export { AppConfig, PluginConfig } from './worker'

const version = require('../package').version as string
export { version }
