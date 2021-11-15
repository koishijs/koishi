import { Argv, Assets, Context, Dict, noop, Schema, Tables, Time } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

declare module 'koishi' {
  interface User {
    lastCall: Date
  }
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      meta: MetaProvider
    }
  }
}

Tables.extend('user', {
  lastCall: 'timestamp',
})

export class MetaProvider extends DataSource<MetaProvider.Payload> {
  timestamp = 0
  cached: Promise<MetaProvider.Payload>
  callbacks: MetaProvider.Extension[] = []

  constructor(ctx: Context, private config: MetaProvider.Config) {
    super(ctx, 'meta')

    this.extend(async () => ctx.assets?.stats())
    this.extend(async () => ctx.database?.stats())

    ctx.any().on('command', ({ session }: Argv<'lastCall'>) => {
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
    metaInternal: Schema.number('元数据推送的时间间隔。').default(Time.hour),
  })

  export interface Stats {
    allUsers: number
    activeUsers: number
    allGroups: number
    activeGroups: number
    tables: Dict<{
      count: number
      size: number
    }>
  }

  export interface Payload extends Stats, Assets.Stats {}

  export type Extension = () => Promise<Partial<Payload>>
}
