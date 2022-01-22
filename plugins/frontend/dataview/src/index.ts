import { Context, Dict, Query } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  interface Sources {
    tables: DatabaseProvider
  }
}

export default class DatabaseProvider extends DataSource<Dict<Query.TableStats>> {
  static using = ['console', 'database'] as const

  cache: Promise<Dict<Query.TableStats>>

  constructor(ctx: Context) {
    super(ctx, 'tables')

    const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.console.addEntry(resolve(__dirname, filename))
  }

  get(forced = false) {
    if (this.cache && !forced) return this.cache
    return this.cache = this.ctx.database.stats().then(stats => stats.tables)
  }
}
