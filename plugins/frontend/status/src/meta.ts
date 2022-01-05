import { Argv, Assets, Context, Dict, noop, Schema, Time } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

declare module 'koishi' {
  interface User {
    lastCall: Date
  }
}

export class MetaProvider extends DataSource<MetaProvider.Payload> {
  timestamp = 0
  cached: Promise<MetaProvider.Payload>
  callbacks: MetaProvider.Extension[] = []

  constructor(ctx: Context, private config: MetaProvider.Config) {
    super(ctx, 'meta')

    this.extend(async () => ctx.assets?.stats())
    this.extend(async () => ctx.database?.stats())

    this.extend(async () => {
      const activeUsers = await ctx.database?.eval('user', { $count: 'id' }, {
        lastCall: { $gt: new Date(new Date().getTime() - Time.day) },
      })
      return { activeUsers }
    })

    this.extend(async () => {
      const activeGuilds = await ctx.database?.eval('channel', { $count: 'id' }, {
        assignee: { $ne: null },
      })
      return { activeGuilds }
    })

    ctx.model.extend('user', {
      lastCall: 'timestamp',
    })

    ctx.any().on('command', ({ session }: Argv<'lastCall'>) => {
      if (!ctx.database) return
      session.user.lastCall = new Date()
    })
  }

  async get() {
    const now = Date.now()
    if (this.timestamp > now) return this.cached
    this.timestamp = now + this.config.metaInterval
    return this.cached = Promise
      .all(this.callbacks.map(cb => cb().catch(noop)))
      .then(data => Object.assign({}, ...data))
  }

  extend(callback: MetaProvider.Extension) {
    this.timestamp = 0
    this.callbacks.push(callback)
  }
}

export namespace MetaProvider {
  export interface Config {
    metaInterval?: number
  }

  export const Config = Schema.object({
    metaInternal: Schema.number().description('元数据推送的时间间隔。').default(Time.hour),
  })

  export interface Stats {
    size: number
    activeUsers: number
    activeGuilds: number
    tables: Dict<{
      count: number
      size: number
    }>
  }

  export interface Payload extends Stats, Assets.Stats {}

  export type Extension = () => Promise<Partial<Payload>>
}
