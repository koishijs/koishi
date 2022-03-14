import { Adapter } from 'koishi'
import { TelegramBot } from './bot'
import { HttpPolling, HttpServer } from './http'
import * as Telegram from './types'

declare module 'koishi' {
  interface Session {
    telegram?: Telegram.Update & Telegram.Internal
  }
}

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
