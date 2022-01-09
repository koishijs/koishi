import { MongoClient, Db, MongoError, IndexDescription } from 'mongodb'
import { Context, Database, Tables, makeArray, Schema, pick, omit, Query, Model, Dict, noop, KoishiError } from 'koishi'
import { URLSearchParams } from 'url'
import { executeUpdate, executeEval } from '@koishijs/orm-utils'
import { transformQuery, transformEval } from './utils'

declare module 'koishi' {
  interface Database {
    mongo: MongoDatabase
  }

  interface Modules {
    'database-mongo': typeof import('.')
  }
}

type TableType = keyof Tables

interface EvalTask {
  expr: any
  table: TableType
  query: Query
  resolve: (value: any) => void
  reject: (error: Error) => void
}

class MongoDatabase extends Database {
  public client: MongoClient
  public db: Db
  public mongo = this
  private _tableTasks: Dict<Promise<any>> = {}
  private _evalTasks: EvalTask[] = []

  constructor(public ctx: Context, private config: MongoDatabase.Config) {
    super(ctx)
  }

  private connectionStringFromConfig() {
    const { authDatabase, connectOptions, host, database: name, password, port, protocol, username } = this.config
    let mongourl = `${protocol}://`
    if (username) mongourl += `${encodeURIComponent(username)}${password ? `:${encodeURIComponent(password)}` : ''}@`
    mongourl += `${host}${port ? `:${port}` : ''}/${authDatabase || name}`
    if (connectOptions) {
      const params = new URLSearchParams(connectOptions)
      mongourl += `?${params}`
    }
    return mongourl
  }

  async start() {
    const mongourl = this.config.uri || this.connectionStringFromConfig()
    this.client = await MongoClient.connect(mongourl)
    this.db = this.client.db(this.config.database)

    for (const name in this.ctx.model.config) {
      this._tableTasks[name] = this._syncTable(name)
    }

    this.ctx.on('model', (name) => {
      this._tableTasks[name] = this._syncTable(name)
    })
  }

  stop() {
    return this.client.close()
  }

  /** synchronize table schema */
  private async _syncTable(name: string) {
    await this._tableTasks[name]
    const coll = await this.db.createCollection(name).catch(() => this.db.collection(name))
    const { primary, unique } = this.ctx.model.config[name]
    const newSpecs: IndexDescription[] = []
    const oldSpecs = await coll.indexes()
    ;[primary, ...unique].forEach((keys, index) => {
      keys = makeArray(keys)
      const name = (index ? 'unique:' : 'primary:') + keys.join('+')
      if (oldSpecs.find(spec => spec.name === name)) return
      const key = Object.fromEntries(keys.map(key => [key, 1]))
      newSpecs.push({ name, key, unique: true })
    })
    if (!newSpecs.length) return
    await coll.createIndexes(newSpecs)
  }

  private _createFilter(name: string, query: Query) {
    return transformQuery(this.ctx.model.resolveQuery(name, query))
  }

  async drop() {
    await Promise.all(Object.keys(this.ctx.model.config).map(name => this.db.dropCollection(name)))
  }

  private async _collStats() {
    const tables = Object.keys(this.ctx.model.config)
    const entries = await Promise.all(tables.map(async (name) => {
      const coll = this.db.collection(name)
      const { count, size } = await coll.stats()
      return [coll.collectionName, { count, size }] as const
    }))
    return Object.fromEntries(entries)
  }

  async stats() {
    // https://docs.mongodb.com/manual/reference/command/dbStats/#std-label-dbstats-output
    const [{ totalSize }, tables] = await Promise.all([
      this.db.stats(),
      this._collStats(),
    ])
    return { size: totalSize, tables }
  }

  async get(name: TableType, query: Query, modifier: Query.Modifier) {
    const filter = this._createFilter(name, query)
    let cursor = this.db.collection(name).find(filter)
    const { fields, limit, offset = 0, sort } = Query.resolveModifier(modifier)
    cursor = cursor.project({ _id: 0, ...Object.fromEntries((fields ?? []).map(key => [key, 1])) })
    if (offset) cursor = cursor.skip(offset)
    if (limit) cursor = cursor.limit(offset + limit)
    if (sort) cursor = cursor.sort(sort)
    return await cursor.toArray() as any
  }

  async set(name: TableType, query: Query, update: {}) {
    await this._tableTasks[name]
    const { primary } = this.ctx.model.config[name]
    const indexFields = makeArray(primary)
    const updateFields = new Set(Object.keys(update).map(key => key.split('.', 1)[0]))
    const filter = this._createFilter(name, query)
    const coll = this.db.collection(name)
    const original = await coll.find(filter).toArray()
    if (!original.length) return
    const bulk = coll.initializeUnorderedBulkOp()
    for (const item of original) {
      bulk.find(pick(item, indexFields)).updateOne({ $set: pick(executeUpdate(item, update), updateFields) })
    }
    await bulk.execute()
  }

  async remove(name: TableType, query: Query) {
    const filter = this._createFilter(name, query)
    await this.db.collection(name).deleteMany(filter)
  }

  private queue(name: TableType, callback: () => Promise<any>) {
    return this._tableTasks[name] = Promise.resolve(this._tableTasks[name]).catch(noop).then(callback)
  }

  async create(name: TableType, data: any) {
    const coll = this.db.collection(name)
    return this.queue(name, async () => {
      const { primary, fields, autoInc } = this.ctx.model.config[name]
      if (autoInc && !Array.isArray(primary) && !(primary in data)) {
        const [latest] = await coll.find().sort(primary, -1).limit(1).toArray()
        data[primary] = latest ? +latest[primary] + 1 : 1
        if (Model.Field.string.includes(fields[primary].type)) {
          data[primary] += ''
          data[primary] = data[primary].padStart(8, '0')
        }
      }
      const copy = { ...this.ctx.model.create(name), ...data }
      try {
        await coll.insertOne(copy)
        delete copy._id
        return copy
      } catch (err) {
        if (err instanceof MongoError && err.code === 11000) {
          throw new KoishiError(err.message, 'database.duplicate-entry')
        }
        throw err
      }
    })
  }

  async upsert(name: TableType, data: any[], keys: string | string[]) {
    if (!data.length) return
    if (!keys) keys = this.ctx.model.config[name].primary
    const indexFields = makeArray(keys)
    await this._tableTasks[name]
    const coll = this.db.collection(name)
    const original = await coll.find({ $or: data.map(item => pick(item, indexFields)) }).toArray()
    const bulk = coll.initializeUnorderedBulkOp()
    for (const update of data) {
      const item = original.find(item => indexFields.every(key => item[key].valueOf() === update[key].valueOf()))
      if (item) {
        const updateFields = new Set(Object.keys(update).map(key => key.split('.', 1)[0]))
        const override = omit(pick(executeUpdate(item, update), updateFields), indexFields)
        bulk.find(pick(item, indexFields)).updateOne({ $set: override })
      } else {
        bulk.insert(executeUpdate(this.ctx.model.create(name), update))
      }
    }
    await bulk.execute()
  }

  eval(table: TableType, expr: any, query: Query) {
    return new Promise<any>((resolve, reject) => {
      this._evalTasks.push({ expr, table, query, resolve, reject })
      process.nextTick(() => this._flushEvalTasks())
    })
  }

  private async _flushEvalTasks() {
    const tasks = this._evalTasks
    if (!tasks.length) return
    this._evalTasks = []

    const stages: any[] = [{ $match: { _id: null } }]
    for (const task of tasks) {
      const { expr, table, query } = task
      task.expr = transformEval(expr, (pipeline: any[]) => {
        pipeline.unshift({ $match: this._createFilter(table, query) })
        stages.push({ $unionWith: { coll: table, pipeline } })
      })
    }

    let data: any
    try {
      const results = await this.db.collection('user').aggregate(stages).toArray()
      data = Object.assign({}, ...results)
    } catch (error) {
      tasks.forEach(task => task.reject(error))
      return
    }

    for (const { expr, resolve, reject } of tasks) {
      try {
        resolve(executeEval(data, expr))
      } catch (error) {
        reject(error)
      }
    }
  }
}

namespace MongoDatabase {
  export const name = 'database-mongo'

  export interface Config {
    username?: string
    password?: string
    protocol?: string
    host?: string
    port?: number
    /** database name */
    database?: string
    /** default auth database */
    authDatabase?: string
    connectOptions?: ConstructorParameters<typeof URLSearchParams>[0]
    /** connection string (will overwrite all configs except 'name') */
    uri?: string
  }

  export const Config = Schema.object({
    protocol: Schema.string().description('要使用的协议名。').default('mongodb'),
    host: Schema.string().description('要连接到的主机名。').default('localhost'),
    port: Schema.number().description('要连接到的端口号。'),
    username: Schema.string().description('要使用的用户名。'),
    password: Schema.string().description('要使用的密码。'),
    database: Schema.string().description('要访问的数据库名。').default('koishi'),
  })
}

export default MongoDatabase
