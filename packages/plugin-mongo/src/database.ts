import { MongoClient, Db, Collection } from 'mongodb'
import { App, TableType } from 'koishi-core'
import { URLSearchParams } from 'url'

export interface Config {
  username?: string
  password?: string
  protocol?: string
  host?: string
  port?: number
  /** database name */
  name?: string
  prefix?: string
  /** default auth database */
  authDatabase?: string
  connectOptions?: ConstructorParameters<typeof URLSearchParams>[0]
  /** connection string (will overwrite all configs except 'name' and 'prefix') */
  uri?: string
}

export default class MongoDatabase {
  public config: Config
  public client: MongoClient
  public db: Db

  user: Collection<any>
  channel: Collection<any>

  constructor(public app: App, config: Config) {
    this.config = config
  }

  async start() {
    const mongourl = this.config.uri || this.connectionStringFromConfig()
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
    this.channel = this.db.collection('channel')
    await this.channel.createIndex({ type: 1, pid: 1 }, { unique: true })
  }

  stop() {
    return this.client.close()
  }

  connectionStringFromConfig() {
    const { authDatabase, connectOptions, host, name, password, port, protocol, username } = this.config
    let mongourl = `${protocol}://`
    if (username) mongourl += `${username}${password ? `:${password}` : ''}@`
    mongourl += `${host}${port ? `:${port}` : ''}/${authDatabase || name}`
    if (connectOptions) {
      const params = new URLSearchParams(connectOptions)
      mongourl += `?${params}`
    }
    return mongourl
  }
}
