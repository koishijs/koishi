import { Adapter } from 'koishi-core'
import HttpServer from './http'
import { AxiosRequestConfig } from 'axios'

interface TelegramOptions {
  endpoint?: string
  path?: string
  selfUrl?: string
  axiosConfig?: AxiosRequestConfig
}

declare module 'koishi-core' {
  interface BotOptions {
    token?: string
  }

  interface AppOptions {
    telegram?: TelegramOptions
  }
}

export * from './bot'
export * from './http'

Adapter.types.telegram = HttpServer
