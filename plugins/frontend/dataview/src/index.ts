import { Context, Dict, Query } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      tables: DatabaseProvider
    }
  }
}

export default class DatabaseProvider extends DataService<Dict<Query.TableStats>> {
  static using = ['console', 'database'] as const

  cache: Promise<Dict<Query.TableStats>>

  constructor(ctx: Context) {
    super(ctx, 'tables')

    if (ctx.console.config.devMode) {
      ctx.console.addEntry(resolve(__dirname, '../client/index.ts'))
    } else {
      ctx.console.addEntry(resolve(__dirname, '../dist/index.es.js'))
      ctx.console.addEntry(resolve(__dirname, '../dist/style.css'))
    }
  }

  get(forced = false) {
    if (this.cache && !forced) return this.cache
    return this.cache = this.ctx.database.stats().then(stats => stats.tables)
  }
}
