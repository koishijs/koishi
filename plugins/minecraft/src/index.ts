import { Adapter } from 'koishi-core'
import { MinecraftBot } from './bot'
import WsClient from './ws'
export * from './bot'

declare module 'koishi-core' {
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
