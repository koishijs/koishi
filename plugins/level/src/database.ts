import { App, Database, Tables, TableType } from 'koishi'
import type { AbstractIteratorOptions } from 'abstract-leveldown'
import type { LevelUp } from 'levelup'
import level from 'level'
import sub from 'subleveldown'
import { resolveLocation } from './runtime'

declare module 'abstract-leveldown' {
  export interface AbstractIterator<K, V> extends AbstractOptions {
    [Symbol.asyncIterator](): AsyncIterator<[K, V]>
  }
}

function createValueEncoding(table: string) {
  const { fields } = Tables.config[table]
  const dates = Object.keys(fields).filter(f => ['timestamp', 'date', 'time'].includes(fields[f].type))
  if (!dates.length) {
    return {
      encode: JSON.stringify,
      decode: JSON.parse,
      buffer: false,
      type: 'json',
    }
  } else {
    return {
      encode: JSON.stringify,
      decode: (str: string) => {
        const obj = JSON.parse(str)
        dates.forEach(key => obj[key] = new Date(obj[key]))
        return obj
      },
      buffer: false,
      type: 'json-for-' + table,
    }
  }
}

export interface Config {
  location: string
  separator?: string
}

export class LevelDatabase extends Database {
  public level = this

  #level: LevelUp
  #tables: Record<string, LevelUp>
  #last: Promise<any>

  constructor(public app: App, public config: Config) {
    super(app)
  }

  async start() {
    // LevelDB will automaticely open
    this.#level = level(resolveLocation(this.config.location))
    this.#tables = Object.create(null)
  }

  async stop() {
    await this.#level.close()
  }

  table<K extends TableType>(table: K): LevelUp {
    return this.#tables[table] ??= sub(this.#level, table, { valueEncoding: createValueEncoding(table) })
  }

  _tableIterator<K extends TableType>(table: K, options: AbstractIteratorOptions) {
    return this.table(table).iterator(options)
  }

  async _dropAll() {
    this.#tables = Object.create(null)
    await this.#level.clear()
  }

  async _dropTable<K extends TableType>(table: K) {
    await this.table(table).clear()
    delete this.#tables[table]
  }

  async _maxKey<K extends TableType>(table: K) {
    // @ts-ignore
    // eslint-disable-next-line no-unreachable-loop
    for await (const [key] of this._tableIterator(table, { reverse: true, limit: 1 })) {
      return +key
    }
    return 0
  }

  async _exists<K extends TableType>(table: K, key: string) {
    try {
      // Avoid deserialize
      await this.table(table).get(key, { valueEncoding: 'binary' })
      return true
    } catch {
      return false
    }
  }

  _makeKey(primary: string | string[], data: any) {
    return (Array.isArray(primary)
      ? primary.map(key => data[key]).join(this.config.separator)
      : data[primary])
  }

  async queue<T>(factory: () => Promise<T>): Promise<T> {
    return this.#last = this.#last.catch(() => {}).then(factory)
  }
}
