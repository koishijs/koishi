import { Dict, makeArray, MaybeArray } from '@koishijs/utils'
import { Eval, Update } from './eval'
import { Field, Model } from './model'
import { Query } from './query'
import { Flatten, Indexable, Keys } from './utils'
import { Direction, Executable, Modifier, Selection, Selector } from './selection'

export type Result<S, K, T = (...args: any) => any> = {
  [P in keyof S as S[P] extends T ? P : P extends K ? P : never]: S[P]
}

export namespace Driver {
  export interface Stats {
    size?: number
    tables?: Dict<TableStats>
  }

  export interface TableStats {
    count: number
    size: number
  }

  export type Cursor<K extends string = never> = K[] | CursorOptions<K>

  export interface CursorOptions<K> {
    limit?: number
    offset?: number
    fields?: K[]
    sort?: Dict<Direction>
  }
}

export class Database<S = any> {
  public tables: { [K in Keys<S>]?: Model<S[K]> } = {}
  public drivers: Dict<Driver> = {}

  constructor(public mapper: Dict<string> = {}) {}

  setDriver(name: string, driver: Driver) {
    if (!driver) {
      delete this.drivers[name]
    } else {
      this.drivers[name] = driver
    }
  }

  private getDriver(name: string) {
    if (this.mapper[name]) return this.drivers[this.mapper[name]]
    return Object.values(this.drivers)[0]
  }

  extend<K extends Keys<S>>(name: K, fields: Field.Extension<S[K]>, config: Model.Config<S[K]> = {}) {
    const model = this.tables[name] ||= new Model<any>(name)
    model.extend(fields, config)
    this.getDriver(name)?.prepare(name)
  }

  select<T extends Selector<S>>(table: T, query?: Query<Selector.Resolve<S, T>>): Selection<Selector.Resolve<S, T>> {
    return new Selection(this.getDriver(table), table, query)
  }

  get<T extends Keys<S>, K extends Keys<S[T]>>(table: T, query: Query<Selector.Resolve<S, T>>, cursor?: Driver.Cursor<K>): Promise<Result<S[T], K>[]> {
    if (Array.isArray(cursor)) {
      cursor = { fields: cursor }
    } else if (!cursor) {
      cursor = {}
    }

    const selection = this.select(table, query)
    if (cursor.fields) selection.project(cursor.fields)
    if (cursor.limit !== undefined) selection.limit(cursor.limit)
    if (cursor.offset !== undefined) selection.offset(cursor.offset)
    if (cursor.sort) {
      for (const field in cursor.sort) {
        selection.orderBy(field as any, cursor.sort[field])
      }
    }
    return selection.execute()
  }

  eval<K extends Keys<S>, T>(table: K, expr: Selection.Callback<S[K], T>, query?: Query): Promise<T>
  /** @deprecated use selection callback instead */
  eval(table: Keys<S>, expr: any, query?: Query): any
  eval(table: Keys<S>, expr: any, query?: Query) {
    return this.select(table, query)
      .evaluate(typeof expr === 'function' ? expr : () => expr)
      .execute()
  }

  set<T extends Keys<S>>(table: T, query: Query<Selector.Resolve<S, T>>, update: Selection.Yield<S[T], Update<S[T]>>): Promise<void> {
    const sel = this.select(table, query)
    if (typeof update === 'function') update = update(sel.row)
    const primary = makeArray(sel.model.primary)
    if (primary.some(key => key in update)) {
      throw new TypeError(`cannot modify primary key`)
    }
    return sel.action('set', sel.model.format(update)).execute()
  }

  remove<T extends Keys<S>>(table: T, query: Query<Selector.Resolve<S, T>>): Promise<void> {
    const sel = this.select(table, query)
    return sel.action('remove').execute()
  }

  create<T extends Keys<S>>(table: T, data: Partial<S[T]>): Promise<S[T]> {
    const sel = this.select(table)
    return sel.action('create', data).execute()
  }

  upsert<T extends Keys<S>>(table: T, upsert: Selection.Yield<S[T], Update<S[T]>[]>, keys?: MaybeArray<Keys<Flatten<S[T]>, Indexable>>): Promise<void> {
    const sel = this.select(table)
    if (typeof upsert === 'function') upsert = upsert(sel.row)
    upsert = upsert.map(item => sel.model.format(item))
    keys = makeArray(keys || sel.model.primary) as any
    return sel.action('upsert', upsert, keys).execute()
  }

  drop() {
    return Promise.all(Object.values(this.drivers).map(driver => driver.drop()))
  }

  async stats() {
    const stats: Driver.Stats = { size: 0, tables: {} }
    await Promise.all(Object.values(this.drivers).map(async (driver) => {
      const { size, tables } = await driver.stats()
      stats.size += size
      Object.assign(stats.tables, tables)
    }))
    return stats
  }
}

export abstract class Driver {
  abstract drop(): Promise<void>
  abstract stats(): Promise<Driver.Stats>
  abstract prepare(name: string): void
  abstract get(sel: Executable, modifier: Modifier): Promise<any>
  abstract eval(sel: Executable, expr: Eval.Expr): Promise<any>
  abstract set(sel: Executable, data: Update): Promise<void>
  abstract remove(sel: Executable): Promise<void>
  abstract create(sel: Executable, data: any): Promise<any>
  abstract upsert(sel: Executable, data: any[], keys: string[]): Promise<void>

  constructor(public database: Database, public name: string) {}

  async start() {
    for (const name in this.database.tables) {
      this.prepare(name)
    }
    this.database.setDriver(this.name, this)
  }

  async stop() {
    this.database.setDriver(this.name, null)
  }

  model(name: string) {
    const model = this.database.tables[name]
    if (model) return model
    throw new TypeError(`unknown table name "${name}"`)
  }

  execute(executable: Executable) {
    const { type, args } = executable
    return this[type as any](executable, ...args)
  }
}
