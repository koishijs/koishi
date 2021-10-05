import { App, Database, TableType } from 'koishi'
import { deserialize, serialize } from 'v8'
import type { AbstractIteratorOptions } from 'abstract-leveldown'
import type { LevelUp } from 'levelup'
import level from 'level'
import sub from 'subleveldown'

const valueEncoding = {
  encode: serialize,
  decode: deserialize,
  buffer: true,
  type: 'sca',
}

export interface Config {
  path: string
  separator: string
}

export class LevelDatabase extends Database {
  public level = this

  #level: LevelUp
  #tables: Record<string, LevelUp>

  constructor(public app: App, public config: Config) {
    super(app)

    this.#level = level(config.path)
    this.#tables = Object.create(null)
  }

  async start() {
    // LevelDB will automaticely open
  }

  async stop() {
    await this.#level.close()
  }

  table<K extends TableType>(table: K): LevelUp {
    // LevelDB's type definition is not complete
    return this.#tables[table] ?? (this.#tables[table] = sub(this.#level, table, { valueEncoding }))
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
}
