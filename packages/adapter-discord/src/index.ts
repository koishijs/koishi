import { Adapter } from 'koishi-core'
import { AxiosRequestConfig } from 'axios'
import { DiscordBot } from './bot'
import WsClient from './ws'
import * as DC from './types'
export * from './bot'

interface DiscordOptions extends Adapter.WsClientOptions {
  endpoint?: string
  axiosConfig?: AxiosRequestConfig
}

declare module 'koishi-core' {
  interface AppOptions {
    discord?: DiscordOptions
  }

  interface Session {
    discord?: {
      mentions: DC.User[]
      // eslint-disable-next-line camelcase
      webhook_id?: DC.snowflake
      flags: number
    }
  }

  namespace Bot {
    interface Platforms {
      discord: DiscordBot
    }
  }
}

Adapter.types['discord'] = WsClient
