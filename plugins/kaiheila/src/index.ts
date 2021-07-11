import { Adapter } from 'koishi'
import { KaiheilaBot } from './bot'
import HttpServer from './http'
import WsClient from './ws'

interface KaiheilaOptions extends Adapter.WsClientOptions {
  path?: string
  endpoint?: string
  attachMode?: 'separate' | 'card' | 'mixed'
}

declare module '@koishijs/core' {
  interface AppOptions {
    kaiheila?: KaiheilaOptions
  }

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
Adapter.types['kaiheila'] = Adapter.redirect((bot) => {
  return bot.verifyToken ? 'kaiheila:http' : 'kaiheila:ws'
})
