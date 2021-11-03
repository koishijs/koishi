import { Context, Time } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'
import Logs from './logs'
import Meta from './meta'
import Profile from './profile'
import Statistics, { Synchronizer } from './stats'

import './database/mongo'
import './database/mysql'

declare module 'koishi' {
  interface Database {
    stats(): Promise<Meta.Stats>
    createSynchronizer(): Synchronizer
  }

  interface Modules {
    configurator: typeof import('.')
  }
}

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
      logs: Logs
      meta: Meta
      profile: Profile
      stats: Statistics
    }
  }
}

export * from './logs'
export * from './meta'
export * from './profile'
export * from './stats'

export { Meta, Profile, Statistics }

export interface Config extends Logs.Config, Meta.Config, Profile.Config, Statistics.Config {}

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
    ctx.webui.sources.logs = new Logs(ctx, config)
    ctx.webui.sources.meta = new Meta(ctx, config)
    ctx.webui.sources.profile = new Profile(ctx, config)
    ctx.webui.sources.stats = new Statistics(ctx, config)
  })
}
