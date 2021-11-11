import { Context, Tables, Time } from 'koishi'
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

export interface Config extends MetaProvider.Config, ProfileProvider.Config, StatisticsProvider.Config {}

const defaultConfig: Config = {
  tickInterval: Time.second * 5,
  statsInternal: Time.minute * 10,
  metaInterval: Time.hour,
}

export const name = 'status'

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultConfig, ...config }

  ctx.with(['console'], (ctx) => {
    const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.console.addEntry(resolve(__dirname, filename))
    ctx.plugin(LogProvider)
    ctx.plugin(MetaProvider, config)
    ctx.plugin(ProfileProvider, config)
    ctx.plugin(StatisticsProvider, config)
  })
}
