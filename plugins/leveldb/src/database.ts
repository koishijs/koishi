import { App, Database, TableType } from 'koishi'
import level from 'level'
import { deserialize, serialize } from 'v8'

const valueEncoding = {
  encode: function (data: any) {
    return serialize(data)
  },
  decode: function (data: Buffer) {
    return deserialize(data)
  },
  buffer: true,
  type: 'sca',
}

export interface Config {
  path: string
}

export class LevelDatabase extends Database {
  public leveldb = this

  _level: level.LevelDB

  constructor(public app: App, public config: Config) {
    super(app)

    this._level = level(config.path, { valueEncoding })
  }

  async start() {
    // LevelDB will automaticely open
  }

  async stop() {
    await this._level.close()
  }

  _table<K extends TableType>(table: K) {
    return this._level.iterator({ gte: table, lte: `${table}\xff` })
  }

  _clear() {
    return this._level.clear()
  }

  _dropTable(table: string) {
    return this._level.clear({ gte: table, lte: `${table}\xff` })
  }

  async _maxKey(table: string) {
    const it = this._level.iterator({ gte: table, lte: `${table}\xff`, reverse: true, limit: 1 })
    // @ts-ignore
    // eslint-disable-next-line no-unreachable-loop
    for await (const [key] of it) {
      return +(key.substr(table.length + 1))
    }
    return 0
  }

  _makeKey(table: string, primary: string | string[], data: any) {
    return table + '$'
    + (Array.isArray(primary)
      ? primary.map(key => data[key]).join('-')
      : data[primary])
  }
}
