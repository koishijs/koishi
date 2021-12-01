import { Adapter } from 'koishi'
import { TelegramBot } from './bot'
import { HttpServer, HttpPolling } from './http'

declare module 'koishi' {
  interface Modules {
    'adapter-telegram': typeof import('.')
  }
}
export const webhookAdapter = Adapter.define('telegram', TelegramBot, HttpServer)
export const pollingAdapter = Adapter.define('telegram', TelegramBot, HttpPolling)


// TODO: fix type error
export default Adapter.define('telegram', TelegramBot, {
  webhook: HttpServer,
  polling: HttpPolling,
}, ({ pollingInterval }) => {
  return pollingInterval !== undefined ? 'polling' : 'webhook'
})
