import { Adapter } from 'koishi'
import { TelegramBot } from './bot'
import { HttpPolling, HttpServer } from './http'

export * as Telegram from './types'
export * from './bot'
export * from './http'
export * from './sender'
export * from './utils'

export default Adapter.define('telegram', TelegramBot, {
  webhook: HttpServer,
  polling: HttpPolling,
}, ({ pollingTimeout }) => {
  return pollingTimeout ? 'polling' : 'webhook'
})
