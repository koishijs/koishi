import { Adapter } from 'koishi-core'
import { AxiosRequestConfig } from 'axios'
import { DiscordBot } from './bot'
import WsClient from './ws'
import { Embed } from './types'

export * from './bot'
export * as dc from './types'

interface DiscordOptions extends Adapter.WsClientOptions {
  axiosConfig?: AxiosRequestConfig
}

declare module 'koishi-core' {
  interface AppOptions {
    discord?: DiscordOptions
  }

  interface Session {
    discord?: {
      embeds: Embed[]
    }
  }

  namespace Bot {
    interface Platforms {
      discord: DiscordBot
    }
  }
}

Adapter.types['discord'] = WsClient
