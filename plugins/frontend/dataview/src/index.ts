import { Context, Dict, Model, Query } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

export type DbEvents = {
  [M in keyof Query.Methods as `dataview/db-${M}`]: Query.Methods[M]
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

  constructor(ctx: Context) {
    super(ctx, 'dbInfo')

    if (ctx.console.config.devMode) {
      ctx.console.addEntry(resolve(__dirname, '../client/index.ts'))
    } else {
      ctx.console.addEntry(resolve(__dirname, '../dist'))
    }

    ctx.console.addListener('dataview/db-create', (...args) => ctx.database.create(...args))
    ctx.console.addListener('dataview/db-drop', (...args) => ctx.database.drop(...args))
    ctx.console.addListener('dataview/db-eval', (...args) => ctx.database.eval(...args))
    ctx.console.addListener('dataview/db-get', (...args) => ctx.database.get(...args))
    ctx.console.addListener('dataview/db-remove', (...args) => ctx.database.remove(...args))
    ctx.console.addListener('dataview/db-set', (...args) => ctx.database.set(...args))
    ctx.console.addListener('dataview/db-stats', (...args) => ctx.database.stats(...args))
    ctx.console.addListener('dataview/db-upsert', (...args) => ctx.database.upsert(...args))

    ctx.on('model', () => this.refresh())
  }

  get(forced = false) {
    if (this.cache && !forced) return this.cache
    return this.cache = this.ctx.database.stats().then(stats => ({ ...stats, model: this.ctx.model.config }))
  }
}
