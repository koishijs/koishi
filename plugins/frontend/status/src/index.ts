import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'
import MetaProvider from './meta'
import ProfileProvider from './profile'
import StatisticsProvider from './stats'

export type Activity = Record<number, number>

declare module 'koishi' {
  interface Channel {
    name: string
    activity: Activity
  }
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      meta: MetaProvider
      profile: ProfileProvider
      stats: StatisticsProvider
    }
  }
}

export {
  MetaProvider,
  ProfileProvider,
  StatisticsProvider,
}

export * from './meta'
export * from './profile'
export * from './stats'

export const name = 'status'
export const using = ['console'] as const

export interface Config extends MetaProvider.Config, ProfileProvider.Config, StatisticsProvider.Config {}

export const Config: Schema<Config> = Schema.intersect([
  MetaProvider.Config,
  ProfileProvider.Config,
  StatisticsProvider.Config,
])

export function apply(ctx: Context, config: Config) {
  ctx.console.addEntry({
    dev: resolve(__dirname, '../client/index.ts'),
    prod: resolve(__dirname, '../dist'),
  })

  ctx.plugin(MetaProvider, config)
  ctx.plugin(ProfileProvider, config)
  ctx.plugin(StatisticsProvider, config)
}
