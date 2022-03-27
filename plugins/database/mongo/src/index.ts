import { Db, IndexDescription, MongoClient, MongoError } from 'mongodb'
import { Context, Database, Dict, DriverError, isNullable, makeArray, Model, noop, omit, pick, Schema, Tables } from 'koishi'
import { executeEval, executeUpdate, Modifier, Query } from '@koishijs/orm'
import { URLSearchParams } from 'url'
import { transformEval, transformQuery } from './utils'

declare module 'koishi' {
  interface Database {
    mongo: MongoDatabase
  }
}

interface EvalTask {
  expr: any
  table: keyof Tables
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

    for (const name in this.model.config) {
      this._tableTasks[name] = this._syncTable(name)
    }

    this.ctx.on('model', (name) => {
      this._tableTasks[name] = this._syncTable(name)
    })
  }

  stop() {
    return this.client.close()
  }

  private async _createIndexes(name: string) {
    const { primary, unique } = this.model.config[name]
    const coll = this.db.collection(name)
    const newSpecs: IndexDescription[] = []
    const oldSpecs = await coll.indexes()
    ;[primary, ...unique].forEach((keys, index) => {
      keys = makeArray(keys)
      const name = (index ? 'unique:' : 'primary:') + keys.join('+')
      if (oldSpecs.find(spec => spec.name === name)) return
      newSpecs.push({
        name,
        key: Object.fromEntries(keys.map(key => [key, 1])),
        unique: true,
        // https://docs.mongodb.com/manual/core/index-partial/#std-label-partial-index-with-unique-constraints
        partialFilterExpression: Object.fromEntries(keys.map(key => [key, { $exists: true }])),
      })
    })
    if (!newSpecs.length) return
    await coll.createIndexes(newSpecs)
  }

  private async _createFields(name: string) {
    const { fields } = this.model.config[name]
    const coll = this.db.collection(name)
    await Promise.all(Object.keys(fields).map((key) => {
      if (isNullable(fields[key].initial)) return
      return coll.updateMany({ [key]: { $exists: false } }, { $set: { [key]: fields[key].initial } })
    }))
  }

  /** synchronize table schema */
  private async _syncTable(name: string) {
    await this._tableTasks[name]
    await this.db.createCollection(name).catch(noop)
    await Promise.all([
      this._createIndexes(name),
      this._createFields(name),
    ])
  }

  private _createFilter(name: keyof Tables, query: Query) {
    return transformQuery(this.resolveQuery(name, query))
  }

  async drop() {
    await Promise.all(Object.keys(this.model.config).map(name => this.db.dropCollection(name)))
  }

  private async _collStats() {
    const tables = Object.keys(this.model.config)
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

  async get(name: keyof Tables, query: Query, modifier: Modifier) {
    const filter = this._createFilter(name, query)
    if (!filter) return []
    await this._tableTasks[name]
    let cursor = this.db.collection(name).find(filter)
    const { fields, limit, offset = 0, sort } = this.resolveModifier(name, modifier)
    if (offset) cursor = cursor.skip(offset)
    if (limit) cursor = cursor.limit(offset + limit)
    if (sort) cursor = cursor.sort(sort)
    return (await cursor.toArray()).map(row => this.resolveData(name, row, fields)) as any
  }

  async set(name: keyof Tables, query: Query, update: {}) {
    const filter = this._createFilter(name, query)
    if (!filter) return
    await this._tableTasks[name]
    const { primary } = this.model.config[name]
    const indexFields = makeArray(primary)
    const coll = this.db.collection(name)
    const original = await coll.find(filter).toArray()
    if (!original.length) return
    update = this.model.format(name, update)
    const updateFields = new Set(Object.keys(update).map(key => key.split('.', 1)[0]))
    const bulk = coll.initializeUnorderedBulkOp()
    for (const item of original) {
      bulk.find(pick(item, indexFields)).updateOne({
        $set: pick(executeUpdate(item, update), updateFields),
      })
    }
    await bulk.execute()
  }

  async remove(name: keyof Tables, query: Query) {
    const filter = this._createFilter(name, query)
    if (!filter) return
    await this.db.collection(name).deleteMany(filter)
  }

  private queue(name: keyof Tables, callback: () => Promise<any>) {
    return this._tableTasks[name] = Promise.resolve(this._tableTasks[name]).catch(noop).then(callback)
  }

  async create<T extends keyof Tables>(name: T, data: any) {
    const coll = this.db.collection(name)
    return this.queue(name, async () => {
      const { primary, fields, autoInc } = this.model.config[name]
      if (autoInc && !Array.isArray(primary) && !(primary in data)) {
        const [latest] = await coll.find().sort(primary, -1).limit(1).toArray()
        data[primary] = latest ? +latest[primary] + 1 : 1
        if (Model.Field.string.includes(fields[primary].type)) {
          data[primary] += ''
          data[primary] = data[primary].padStart(8, '0')
        }
      }
      const copy = this.model.create(name, data)
      try {
        await coll.insertOne(copy)
        delete copy['_id']
        return copy
      } catch (err) {
        if (err instanceof MongoError && err.code === 11000) {
          throw new DriverError('duplicate-entry', err.message)
        }
        throw err
      }
    })
  }

  async upsert(name: keyof Tables, data: any[], keys: string | string[]) {
    if (!data.length) return
    if (!keys) keys = this.model.config[name].primary
    const indexFields = makeArray(keys)
    await this._tableTasks[name]
    const coll = this.db.collection(name)
    const original = await coll.find({ $or: data.map(item => pick(item, indexFields)) }).toArray()
    const bulk = coll.initializeUnorderedBulkOp()
    for (const _item of data) {
      const update = this.model.format(name, _item)
      const item = original.find(item => indexFields.every(key => item[key].valueOf() === update[key].valueOf()))
      if (item) {
        const updateFields = new Set(Object.keys(update).map(key => key.split('.', 1)[0]))
        const override = omit(pick(executeUpdate(item, update), updateFields), indexFields)
        bulk.find(pick(item, indexFields)).updateOne({ $set: override })
      } else {
        bulk.insert(executeUpdate(this.model.create(name), update))
      }
    }
    await bulk.execute()
  }

  eval(table: keyof Tables, expr: any, query: Query) {
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
      task.expr = transformEval(expr, (pipeline) => {
        const filter = this._createFilter(table, query) || { _id: null }
        pipeline.unshift({ $match: filter })
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
    port: Schema.natural().max(65535).description('要连接到的端口号。'),
    username: Schema.string().description('要使用的用户名。'),
    password: Schema.string().description('要使用的密码。').role('secret'),
    database: Schema.string().description('要访问的数据库名。').default('koishi'),
  })
}

export default MongoDatabase
