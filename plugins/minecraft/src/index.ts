import { Adapter } from 'koishi'
import { MinecraftBot } from './bot'
import WsClient from './ws'
export * from './bot'

declare module 'koishi' {
  interface AppOptions {
    minecraft?: {}
  }

  namespace Bot {
    interface Platforms {
      minecraft: MinecraftBot
    }
  }
}

Adapter.types['minecraft'] = WsClient
