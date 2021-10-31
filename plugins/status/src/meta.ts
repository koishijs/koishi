import { Argv, Assets, Context, Dict, noop } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

class Meta implements DataSource<Meta.Payload> {
  timestamp = 0
  cached: Promise<Meta.Payload>
  callbacks: Meta.Extension[] = []

  constructor(private ctx: Context, public config: Meta.Config) {
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

  extend(callback: Meta.Extension) {
    this.timestamp = 0
    this.callbacks.push(callback)
  }
}

namespace Meta {
  export interface Config {
    metaInterval?: number
  }

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

export default Meta
