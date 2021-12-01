import { Adapter } from 'koishi'
import { TelegramBot } from './bot'
import { HttpServer, HttpPolling } from './http'

declare module 'koishi' {
  interface Modules {
    'adapter-telegram': typeof import('.')
  }
}

export default Adapter.define('telegram', TelegramBot, {
  webhook: HttpServer,
  polling: HttpPolling,
}, ({ pollingInterval }) => {
  return pollingInterval !== undefined ? 'polling' : 'webhook'
})
