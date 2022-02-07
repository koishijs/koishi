import { Context, Dict, Model, Query } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

export type AsyncFallible<T extends (...args: unknown[]) => Promise<R>, R = unknown>
  = (...args: Parameters<T>) =>
    Promise<{ success: R } | { failed: any }>

export type A = (...args: unknown[]) => Promise<unknown>
export let a: Awaited<ReturnType<A>>

// export type DbEvents = {
//   [M in keyof Query.Methods as `dataview/db-${M}`]: AsyncFallible<Query.Methods[M]>
// }
export type DbEvents = {
  [M in keyof Query.Methods as `dataview/db-${M}`]: (...args: Parameters<Query.Methods[M]>) => Promise<{
    ok: true
    success: Awaited<ReturnType<Query.Methods[M]>>
  } | {
    ok: false
    failed: Error
  }>
}
export type B = Query.Methods['eval']

export type C = DbEvents['dataview/db-eval']

export let b: ReturnType<DbEvents['dataview/db-set']>
declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      dbInfo: DatabaseProvider
    }
  }
  interface Events extends DbEvents { }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function addDbListener<M extends keyof Query.Methods>(ctx: Context, methodName: M) {
  ctx.console.addListener<`dataview/db-${M}`>(`dataview/db-${methodName}`, async (...args) => {
    try {
      return { ok: true as const, success: await (ctx.database[methodName] as any)(...args) }
    } catch (e) {
      return { ok: false as const, failed: { stack: e.stack, ...e } }
    }
  })
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

    addDbListener(ctx, 'drop')
    addDbListener(ctx, 'stats')
    addDbListener(ctx, 'get')
    addDbListener(ctx, 'set')
    addDbListener(ctx, 'remove')
    addDbListener(ctx, 'create')
    addDbListener(ctx, 'upsert')
    addDbListener(ctx, 'eval')

    ctx.on('model', () => this.refresh())
  }

  get(forced = false) {
    if (this.cache && !forced) return this.cache
    return this.cache = this.ctx.database.stats().then(stats => ({ ...stats, model: this.ctx.model.config }))
  }
}
