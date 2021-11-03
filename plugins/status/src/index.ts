import { Context, Time } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'
import { LogProvider } from './logs'
import { MetaProvider } from './meta'
import { ProfileProvider } from './profile'
import { StatisticsProvider, Synchronizer } from './stats'

import './database/mongo'
import './database/mysql'

declare module 'koishi' {
  interface Database {
    stats(): Promise<MetaProvider.Stats>
    createSynchronizer(): Synchronizer
  }

  interface Modules {
    configurator: typeof import('.')
  }
}

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
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

export interface Config extends MetaProvider.Config, ProfileProvider.Config, StatisticsProvider.Config {}

const defaultConfig: Config = {
  tickInterval: Time.second * 5,
  statsInternal: Time.minute * 10,
  metaInterval: Time.hour,
}

export const name = 'status'

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultConfig, ...config }

  ctx.with(['console'], () => {
    const filename = ctx.webui.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.webui.addEntry(resolve(__dirname, filename))
    new LogProvider(ctx)
    new MetaProvider(ctx, config)
    new ProfileProvider(ctx, config)
    new StatisticsProvider(ctx, config)
  })
}
