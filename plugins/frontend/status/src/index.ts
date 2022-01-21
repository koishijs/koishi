import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'
import { MetaProvider } from './meta'
import { ProfileProvider } from './profile'
import { StatisticsProvider } from './stats'

export type Activity = Record<number, number>

declare module 'koishi' {
  interface Database {
    stats(): Promise<MetaProvider.Stats>
  }

  interface Channel {
    name: string
    activity: Activity
  }

  interface Modules {
    manager: typeof import('.')
  }
}

declare module '@koishijs/plugin-console' {
  interface Sources {
    meta: MetaProvider
    profile: ProfileProvider
    stats: StatisticsProvider
  }
}

export * from './meta'
export * from './profile'
export * from './stats'

export const name = 'status'
export const using = ['console'] as const

export interface Config extends MetaProvider.Config, ProfileProvider.Config, StatisticsProvider.Config {}

export const Config = Schema.intersect([
  MetaProvider.Config,
  ProfileProvider.Config,
  StatisticsProvider.Config,
])

Context.service('console.meta')
Context.service('console.profile')
Context.service('console.stats')

export function apply(ctx: Context, config: Config) {
  const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
  ctx.console.addEntry(resolve(__dirname, filename))
  ctx.plugin(MetaProvider, config)
  ctx.plugin(ProfileProvider, config)
  ctx.plugin(StatisticsProvider, config)
}
