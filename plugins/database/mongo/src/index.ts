import { Db, IndexDescription, MongoClient, MongoError } from 'mongodb'
import { Context, Database, Dict, DriverError, isNullable, makeArray, noop, omit, pick, Schema, Tables } from 'koishi'
import { Executable, executeEval, Field, Query } from '@koishijs/orm'
import { URLSearchParams } from 'url'
import { transformEval, transformQuery } from './utils'

declare module 'koishi' {
  interface Database {
    mongo: MongoDatabase
  }
}

interface EvalTask {
  expr: any
  table: string
  query: Query.Expr
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

    for (const name in this.models) {
      this._tableTasks[name] = this._syncTable(name as keyof Tables)
    }

    this.ctx.on('model', (name) => {
      this._tableTasks[name] = this._syncTable(name)
    })
  }

  stop() {
    return this.client.close()
  }

  private async _createIndexes(name: keyof Tables) {
    const { primary, unique } = this.model(name)
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

  private async _createFields(name: keyof Tables) {
    const { fields } = this.model(name)
    const coll = this.db.collection(name)
    await Promise.all(Object.keys(fields).map((key) => {
      if (isNullable(fields[key].initial)) return
      return coll.updateMany({ [key]: { $exists: false } }, { $set: { [key]: fields[key].initial } })
    }))
  }

  /** synchronize table schema */
  private async _syncTable(name: keyof Tables) {
    await Promise.resolve(this._tableTasks[name]).catch(noop)
    await this.db.createCollection(name).catch(noop)
    await Promise.all([
      this._createIndexes(name),
      this._createFields(name),
    ])
  }

  async drop() {
    await Promise.all(Object.keys(this.models).map(name => this.db.dropCollection(name)))
  }

  private async _collStats() {
    const tables = Object.keys(this.models)
    const entries = await Promise.all(tables.map(async (name) => {
      const coll = this.db.collection(name)
      const { count, size } = await coll.stats()
      return [coll.collectionName, { count, size }] as const
    }))
    return Object.fromEntries(entries)
  }

  async stats() {
    // https://docs.mongodb.com/manual/reference/command/dbStats/#std-label-dbstats-output
    const [stats, tables] = await Promise.all([
      this.db.stats(),
      this._collStats(),
    ])
    // While MongoDB's document above says that the `stats.totalSize` is the sum of
    // `stats.dataSize` and `stats.storageSize`, it's actually `undefined` in some cases.
    // So we have to calculate it manually.
    const totalSize = stats.indexSize + stats.storageSize
    return { size: totalSize, tables }
  }

  async execute(sel: Executable) {
    const { table, fields, modifier, expr, query } = sel
    const filter = transformQuery(query)
    if (!filter) return []
    if (expr) {
      return new Promise<any>((resolve, reject) => {
        this._evalTasks.push({ expr, table, query, resolve, reject })
        process.nextTick(() => this._flushEvalTasks())
      })
    } else {
      const { offset, limit, sort } = modifier
      let cursor = this.db.collection(table).find(filter)
      if (limit < Infinity) {
        cursor = cursor.limit(offset + limit)
      }
      cursor = cursor.skip(offset)
      cursor = cursor.sort(Object.fromEntries(sort.map(([k, v]) => [k['$'][1], v === 'desc' ? -1 : 1])))
      const data = await cursor.toArray()
      return data.map(row => sel.resolveData(row, fields))
    }
  }

  private async _flushEvalTasks() {
    const tasks = this._evalTasks
    if (!tasks.length) return
    this._evalTasks = []

    const stages: any[] = [{ $match: { _id: null } }]
    for (const task of tasks) {
      const { expr, table, query } = task
      task.expr = transformEval(expr, (pipeline) => {
        const filter = transformQuery(query) || { _id: null }
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
        resolve(executeEval({ _: data }, expr))
      } catch (error) {
        reject(error)
      }
    }
  }

  async set(name: keyof Tables, query: Query, update: {}) {
    const sel = this.select(name, query)
    const filter = transformQuery(sel.query)
    if (!filter) return
    const indexFields = makeArray(sel.model.primary)
    const coll = this.db.collection(name)
    const original = await coll.find(filter).toArray()
    if (!original.length) return
    update = sel.resolveUpdate(update)
    const updateFields = new Set(Object.keys(update).map(key => key.split('.', 1)[0]))
    const bulk = coll.initializeUnorderedBulkOp()
    for (const item of original) {
      bulk.find(pick(item, indexFields)).updateOne({
        $set: pick(sel.update(item, update), updateFields),
      })
    }
    await bulk.execute()
  }

  async remove(name: keyof Tables, query: Query) {
    const sel = this.select(name, query)
    const filter = transformQuery(sel.query)
    if (!filter) return
    await this.db.collection(name).deleteMany(filter)
  }

  private queue(name: keyof Tables, callback: () => Promise<any>) {
    return this._tableTasks[name] = Promise.resolve(this._tableTasks[name]).catch(noop).then(callback)
  }

  async create<T extends keyof Tables>(name: T, data: any) {
    const coll = this.db.collection(name)
    return this.queue(name, async () => {
      const model = this.model(name)
      const { primary, fields, autoInc } = model
      if (autoInc && !Array.isArray(primary) && !(primary in data)) {
        const [latest] = await coll.find().sort(primary, -1).limit(1).toArray()
        data[primary] = latest ? +latest[primary] + 1 : 1
        if (Field.string.includes(fields[primary].type)) {
          data[primary] += ''
          data[primary] = data[primary].padStart(8, '0')
        }
      }
      const copy = model.create(data)
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
    const sel = this.select(name)
    data = sel.resolveUpsert(data)
    const indexFields = makeArray(keys || sel.model.primary)
    await Promise.resolve(this._tableTasks[name]).catch(noop)
    const coll = this.db.collection(name)
    const original = await coll.find({ $or: data.map(item => pick(item, indexFields)) }).toArray()
    const bulk = coll.initializeUnorderedBulkOp()
    for (const update of data) {
      const item = original.find(item => indexFields.every(key => item[key].valueOf() === update[key].valueOf()))
      if (item) {
        const updateFields = new Set(Object.keys(update).map(key => key.split('.', 1)[0]))
        const override = omit(pick(sel.update(item, update), updateFields), indexFields)
        bulk.find(pick(item, indexFields)).updateOne({ $set: override })
      } else {
        bulk.insert(sel.update(sel.model.create(), update))
      }
    }
    await bulk.execute()
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
