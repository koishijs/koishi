import { Context, Dict, Model, Query } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

export type DbEvents = {
  [M in keyof Query.Methods as `database/${M}`]: Query.Methods[M]
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      dbInfo: DatabaseProvider
    }
  }

  interface Events extends DbEvents { }
}

export type DatabaseInfo = Query.Stats & { model: Dict<Model.Config<any>> }
export default class DatabaseProvider extends DataService<DatabaseInfo> {
  static using = ['console', 'database'] as const

  cache: Promise<DatabaseInfo>

  addListener<K extends keyof Query.Methods>(name: K, refresh = false) {
    return this.ctx.console.addListener(`database/${name}`, async (...args) => {
      const result = await (this.ctx.database[name] as any)(...args)
      if (refresh) {
        this.refresh()
      }
      return result
    })
  }

  constructor(ctx: Context) {
    super(ctx, 'dbInfo')

    if (ctx.console.config.devMode) {
      ctx.console.addEntry(resolve(__dirname, '../client/index.ts'))
    } else {
      ctx.console.addEntry(resolve(__dirname, '../dist'))
    }

    this.addListener('create', true)
    this.addListener('drop', true)
    this.addListener('eval', true)
    this.addListener('get')
    this.addListener('remove', true)
    this.addListener('set')
    this.addListener('stats')
    this.addListener('upsert', true)

    ctx.on('model', () => this.refresh())
  }

  get(forced = false) {
    if (this.cache && !forced) return this.cache
    return this.cache = this.ctx.database.stats().then(stats => ({ ...stats, model: this.ctx.model.config }))
  }
}
