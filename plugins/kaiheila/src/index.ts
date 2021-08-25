import { Adapter, Context, sanitize, trimSlash } from 'koishi'
import { Config, KaiheilaBot } from './bot'
import HttpServer from './http'
import WsClient from './ws'

declare module 'koishi' {
  namespace Bot {
    interface Platforms {
      kaiheila: KaiheilaBot
    }
  }

  interface BotOptions {
    verifyToken?: string
  }
}

export * from './types'
export * from './utils'
export * from './bot'

Adapter.types['kaiheila:http'] = HttpServer
Adapter.types['kaiheila:ws'] = WsClient

Adapter.types.kaiheila = Adapter.redirect((bot) => {
  return bot.verifyToken ? 'kaiheila:http' : 'kaiheila:ws'
})

export const name = 'kaiheila'

export function apply(ctx: Context, config: Config = {}) {
  config.path = sanitize(config.path || '/kaiheila')
  config.endpoint = trimSlash(config.endpoint || 'https://www.kaiheila.cn/api/v3')
  Object.assign(KaiheilaBot.config, config)
}
