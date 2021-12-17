import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'
import { LogProvider } from './logs'
import { MetaProvider } from './meta'
import { ProfileProvider } from './profile'
import { StatisticsProvider, Synchronizer } from './stats'

import './database/mongo'
import './database/mysql'

export type Activity = Record<number, number>

declare module 'koishi' {
  interface Database {
    stats(): Promise<MetaProvider.Stats>
    createSynchronizer(): Synchronizer
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
  namespace Console {
    interface Services {
      logs: LogProvider
      meta: MetaProvider
      profile: ProfileProvider
      stats: StatisticsProvider
    }
  }
}

export * from './logs'
export * from './meta'
export * from './profile'
export * from './stats'

export const name = 'status'
export const using = ['console']

export interface Config extends MetaProvider.Config, ProfileProvider.Config, StatisticsProvider.Config {
  logger?: LogProvider.Config
}

export const Config = Schema.intersect([
  MetaProvider.Config,
  ProfileProvider.Config,
  StatisticsProvider.Config,
  Schema.object({
    logger: LogProvider.Config,
  }).description('日志选项'),
])

Context.service('console/logs')
Context.service('console/meta')
Context.service('console/profile')
Context.service('console/stats')

export function apply(ctx: Context, config: Config) {
  const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
  ctx.console.addEntry(resolve(__dirname, filename))
  ctx.plugin(LogProvider, config.logger)
  ctx.plugin(MetaProvider, config)
  ctx.plugin(ProfileProvider, config)
  ctx.plugin(StatisticsProvider, config)
}
