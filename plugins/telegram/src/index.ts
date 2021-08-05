import { Adapter, assertProperty, Context, sanitize, trimSlash } from 'koishi'
import { Config, TelegramBot } from './bot'
import HttpServer from './http'

declare module 'koishi' {
  interface BotOptions {
    token?: string
  }

  namespace Bot {
    interface Platforms {
      telegram: TelegramBot
    }
  }
}

export * from './bot'
export * from './http'

Adapter.types.telegram = HttpServer

export const name = 'telegram'

export function apply(ctx: Context, config: Config = {}) {
  Object.assign(TelegramBot.config, config)
  config.path = sanitize(config.path || '/telegram')
  config.endpoint = trimSlash(config.endpoint || 'https://api.telegram.org')
  if (config.selfUrl) {
    config.selfUrl = trimSlash(config.selfUrl)
  } else {
    config.selfUrl = assertProperty(ctx.app.options, 'selfUrl')
  }
}
