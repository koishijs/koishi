import { Context, Schema, Tables } from 'koishi'
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

Tables.extend('channel', {
  name: 'string(50)',
  activity: 'json',
})

export * from './logs'
export * from './meta'
export * from './profile'
export * from './stats'

export const name = 'status'

export interface Config extends MetaProvider.Config, ProfileProvider.Config, StatisticsProvider.Config {
  logger?: LogProvider.Config
}

export const Config = Schema.intersect([
  MetaProvider.Config,
  ProfileProvider.Config,
  StatisticsProvider.Config,
  Schema.object({
    logger: LogProvider.Config,
  }, '日志选项'),
])

export function apply(ctx: Context, config: Config) {
  ctx.with(['console'], (ctx) => {
    const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.console.addEntry(resolve(__dirname, filename))
    ctx.plugin(LogProvider, config.logger)
    ctx.plugin(MetaProvider, config)
    ctx.plugin(ProfileProvider, config)
    ctx.plugin(StatisticsProvider, config)
  })
}
