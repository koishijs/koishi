import { Adapter } from 'koishi-core'
import { DiscordBot } from './bot'
import WsClient from './ws'

interface DiscordOptions extends Adapter.WsClientOptions {
}

declare module 'koishi-core' {
  interface AppOptions {
    discord?: DiscordOptions
  }

  namespace Bot {
    interface Platforms {
      discord: DiscordBot
    }
  }
}

Adapter.types['discord'] = WsClient
