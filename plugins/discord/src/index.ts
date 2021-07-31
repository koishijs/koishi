import { Adapter, Context } from 'koishi'
import { DiscordBot, Config } from './bot'
import WsClient from './ws'
import * as DC from './types'
export * from './bot'

declare module '@koishijs/core' {
  interface Session {
    discord?: {
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

Adapter.types.discord = WsClient

export const name = 'discord'

export function apply(ctx: Context, config: Config = {}) {
  DiscordBot.config = {
    axiosConfig: {
      ...ctx.app.options.axiosConfig,
      ...config.axiosConfig,
    },
    ...config,
  }
}
