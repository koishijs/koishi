import { MongoClient, Db, Collection } from 'mongodb'
import { App, Group, TableType } from 'koishi-core'

export interface Config {
  username?: string
  password?: string
  protocol?: string
  host?: string
  port?: number
  name?: string
  prefix?: string
}

export default class MongoDatabase {
  public config: Config
  public client: MongoClient
  public db: Db

  user: Collection<any>
  group: Collection<any>

  constructor(public app: App, config: Config) {
    this.config = config
  }

  async start() {
    let mongourl = `${this.config.protocol}://`
    if (this.config.username) mongourl += `${this.config.username}:${this.config.password}@`
    mongourl += `${this.config.host}:${this.config.port}/${this.config.name}`
    this.client = await MongoClient.connect(
      mongourl, { useNewUrlParser: true, useUnifiedTopology: true },
    )
    this.db = this.client.db(this.config.name)
    if (this.config.prefix) {
      this.db.collection = ((func, prefix) => function collection<T extends TableType>(name: T) {
        return func(`${prefix}.${name}`)
      })(this.db.collection.bind(this.db), this.config.prefix)
    }
    this.user = this.db.collection('user')
    this.group = this.db.collection('group')
  }

  stop() {
    return this.client.close()
  }
}
