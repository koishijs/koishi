import { MongoClient, Db, Collection } from 'mongodb'
import { App, Channel, Database, User, Tables as KoishiTables } from 'koishi'
import { URLSearchParams } from 'url'

type TableType = keyof Tables

export interface Tables extends KoishiTables {}

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

export class MongoDatabase extends Database {
  public config: Config
  public client: MongoClient
  public db: Db

  mongo = this

  user: Collection<User>
  channel: Collection<Channel>

  constructor(public app: App, config?: Config) {
    super(app)
    this.config = {
      host: 'localhost',
      name: 'koishi',
      protocol: 'mongodb',
      ...config,
    }
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

  collection<T extends TableType>(name: T): Collection<Tables[T]> {
    return this.db.collection(name)
  }

  stop() {
    return this.client.close()
  }

  connectionStringFromConfig() {
    const { authDatabase, connectOptions, host, name, password, port, protocol, username } = this.config
    let mongourl = `${protocol}://`
    if (username) mongourl += `${encodeURIComponent(username)}${password ? `:${encodeURIComponent(password)}` : ''}@`
    mongourl += `${host}${port ? `:${port}` : ''}/${authDatabase || name}`
    if (connectOptions) {
      const params = new URLSearchParams(connectOptions)
      mongourl += `?${params}`
    }
    return mongourl
  }
}

export default MongoDatabase
