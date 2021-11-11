import { Database, makeArray, Tables, Logger, Schema, Context, Query, difference } from 'koishi'
import { SQLBuilder, Caster } from '@koishijs/sql-utils'
import sqlite from 'better-sqlite3'
import { resolve } from 'path'
import { escape as sqlEscape, escapeId } from 'sqlstring-sqlite'

declare module 'koishi' {
  interface Database {
    sqlite: SQLiteDatabase
  }

  interface Modules {
    'database-sqlite': typeof import('.')
  }
}

const logger = new Logger('sqlite')

export type TableType = keyof Tables

export interface Config {
  path?: string
}

function getTypeDefinition({ type }: Tables.Field) {
  switch (type) {
    case 'integer':
    case 'unsigned':
    case 'date':
    case 'time':
    case 'timestamp': return `INTEGER`
    case 'float':
    case 'double':
    case 'decimal': return `REAL`
    case 'char':
    case 'string':
    case 'text':
    case 'list':
    case 'json': return `TEXT`
  }
}

export interface ISQLiteFieldInfo {
  name: string
  type: string
  notnull: number
  // eslint-disable-next-line @typescript-eslint/naming-convention
  dflt_value: string
  pk: boolean
}

class SQLiteDatabase extends Database {
  public db: sqlite.Database
  sqlite = this
  sql: SQLBuilder
  caster: Caster

  constructor(public ctx: Context, public config: Config) {
    super(ctx)

    this.config = { path: '.koishi.db', ...config }

    this.sql = new class extends SQLBuilder {
      escapeId = escapeId

      escape(value: any) {
        if (value instanceof Date) {
          return (+value) + ''
        }
        return sqlEscape(value)
      }

      protected createElementQuery(key: string, value: any) {
        return `(',' || ${key} || ',') LIKE '%,${this.escape(value)},%'`
      }
    }()

    this.caster = new Caster()
    this.caster.register<object, string>({
      types: ['json'],
      dump: value => JSON.stringify(value),
      load: (value, initial) => value ? JSON.parse(value) : initial,
    })
    this.caster.register<string[], string>({
      types: ['list'],
      dump: value => value.join(','),
      load: (value) => value ? value.split(',') : [],
    })
    this.caster.register<Date, number>({
      types: ['date', 'time', 'timestamp'],
      dump: value => +value,
      load: (value) => value === null ? null : new Date(value),
    })
  }

  private getColumnDefinitionSQL(table: string, key: string) {
    const config = Tables.config[table]
    const { initial, nullable = initial === undefined || initial === null } = config.fields[key]
    let def = this.sql.escapeId(key)
    if (key === config.primary && config.autoInc) {
      def += ' INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT'
    } else {
      const typedef = getTypeDefinition(config.fields[key])
      def += ' ' + typedef + (nullable ? ' ' : ' NOT ') + 'NULL'
      if (initial !== undefined && initial !== null) {
        def += ' DEFAULT ' + this.sql.escape(this.caster.dump(table, { [key]: initial })[key])
      }
    }
    return def
  }

  private syncTable(table: string) {
    const info = this._getTableInfo(table)
    // FIXME: register platform columns before database initializion
    // WARN: side effecting Tables.config
    const config = Tables.config[table]
    if (table === 'user') {
      new Set(this.ctx.bots.map(bot => bot.platform)).forEach(platform => {
        config.fields[platform] = { type: 'string', length: 63 }
        config.unique.push(platform)
      })
    }
    const keys = Object.keys(config.fields)
    if (info.length) {
      logger.info('auto updating table %c', table)
      const allKeys = [...keys, ...info.map(row => row.name)]
      for (const key of allKeys) {
        if (keys.includes(key) && info.some(({ name }) => name === key)) continue
        if (keys.includes(key)) {
          // Add column
          const def = this.getColumnDefinitionSQL(table, key)
          this.run(`ALTER TABLE ${this.sql.escapeId(table)} ADD COLUMN ${def}`)
        } else {
          // Drop column
          this.run(`ALTER TABLE ${this.sql.escapeId(table)} DROP COLUMN ${this.sql.escapeId(key)}`)
        }
      }
    } else {
      logger.info('auto creating table %c', table)
      const defs = keys.map(key => this.getColumnDefinitionSQL(table, key))
      const constraints = []
      if (config.primary && !config.autoInc) {
        constraints.push(`PRIMARY KEY (${this._joinKeys(makeArray(config.primary))})`)
      }
      if (config.unique) {
        constraints.push(...config.unique.map(keys => `UNIQUE (${this._joinKeys(makeArray(keys))})`))
      }
      if (config.foreign) {
        constraints.push(
          ...Object.entries(config.foreign)
            .map(([key, [table, key2]]) =>
              `FOREIGN KEY (${this.sql.escapeId(key)})
              REFERENCES ${this.sql.escapeId(table)} (${this.sql.escapeId(key2)})`,
            ),
        )
      }
      this.run(`CREATE TABLE ${this.sql.escapeId(table)} (${[...defs, ...constraints].join(',')})`)
    }
  }

  async start() {
    this.db = sqlite(this.config.path === ':memory:' ? this.config.path : resolve(this.config.path))
    this.db.function('regexp', (pattern, str) => +new RegExp(pattern).test(str))
    // Synchronize database schemas
    for (const name in Tables.config) {
      this.syncTable(name)
    }
  }

  _joinKeys(keys?: string[]) {
    return keys ? keys.map(key => this.sql.escapeId(key)).join(',') : '*'
  }

  run(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    try {
      return this.db.prepare(sql).run(params)
    } catch (e) {
      logger.warn('SQL Failed > %c', sql)
      throw e
    }
  }

  get(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    try {
      return this.db.prepare(sql).get(params)
    } catch (e) {
      logger.warn('SQL Failed > %c', sql)
      throw e
    }
  }

  all(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    try {
      return this.db.prepare(sql).all(params)
    } catch (e) {
      logger.warn('SQL Failed > %c', sql)
      throw e
    }
  }

  _getTables(): string[] {
    const rows = this.all(`SELECT name FROM sqlite_master WHERE type='table'`)
    return rows.map(({ name }) => name)
  }

  _getTableInfo(table: string): ISQLiteFieldInfo[] {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return this.all(`PRAGMA table_info(${this.sql.escapeId(table)})`)
  }

  stop() {
    this.db.close()
  }
}

namespace SQLiteDatabase {
  export const name = 'database-sqlite'

  export const schema: Schema<Config> = Schema.object({
    path: Schema.string('数据库路径').default('.koishi.db'),
  }, true)
}

Database.extend(SQLiteDatabase, {
  async drop(name) {
    if (name) {
      this.run(`DROP TABLE ${this.sql.escapeId(name)}`)
    } else {
      const tables = Object.keys(Tables.config)
      for (const table of tables) {
        this.run(`DROP TABLE ${this.sql.escapeId(table)}`)
      }
    }
  },

  async get(name, query, modifier) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    let sql = `SELECT ${this._joinKeys(fields)} FROM ${this.sql.escapeId(name)} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    const rows = this.all(sql)
    return rows.map(row => this.caster.load(name, row))
  },

  async set(name, query, data) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    data = this.caster.dump(name, data)
    const update = Object.keys(data).map((key) => {
      return `${this.sql.escapeId(key)} = ${this.sql.escape(data[key])}`
    }).join(', ')
    this.run(`UPDATE ${this.sql.escapeId(name)} SET ${update} WHERE ${filter}`)
  },

  async remove(name, query) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    this.run(`DELETE FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
  },

  async create(name, data) {
    data = { ...Tables.create(name), ...data }
    const dbData = this.caster.dump(name, data)
    const keys = Object.keys(data)
    try {
      const result = this.run(
      `INSERT INTO ${this.sql.escapeId(name)} (${this._joinKeys(keys)}) VALUES (${keys.map(key => this.sql.escape(dbData[key])).join(', ')})`,
      )
      const config = Tables.config[name]
      if (config?.autoInc) {
        return { ...data, [config.primary as string]: result.lastInsertRowid } as any
      }
      return data as any
    } catch {}
  },

  async upsert(name, data, keys: string | string[]) {
    if (!data.length) return
    const { fields, primary } = Tables.config[name]
    const fallback = Tables.create(name)
    const initKeys = Object.keys(fields)
    keys = makeArray(keys || primary)
    for (const item of data) {
      const updateKeys = Object.keys(item)
      const dbItem = this.caster.dump(name, { ...fallback, ...item })
      const update = difference(updateKeys, keys).map((key) => `${this.sql.escapeId(key)} = ${this.sql.escape(dbItem[key])}`).join(',')
      this.run(
        `INSERT INTO ${this.sql.escapeId(name)} (${this._joinKeys(initKeys)})
        VALUES (${initKeys.map(key => this.sql.escape(dbItem[key])).join(', ')})
        ON CONFLICT DO UPDATE SET ${update}`,
      )
    }
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = this.sql.parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${this.sql.parseEval(fields[key])} AS ${this.sql.escapeId(key)}`).join(', ')
    const data = await this.get(`SELECT ${exprs} FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
    return data
  },
})

export default SQLiteDatabase
