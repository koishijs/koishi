import { URLSearchParams } from 'url'
import { MongoClient, Db, Collection } from 'mongodb'
import { App, TableType } from 'koishi-core'

export interface Config {
  username?: string
  password?: string
  protocol?: string
  host?: string
  port?: number
  name?: string // database name
  prefix?: string
  authDatabase?: string // default auth database
  connectionOptions?: URLSearchParams | string | { [key: string]: string | (string)[] } | Iterable<[string, string]> | Array<[string, string]>
  /** connection string (will overwrite all configs except 'name' and 'prefix') */
  uri?: string
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
    this.group = this.db.collection('group')
  }

  stop() {
    return this.client.close()
  }

  connectionStringFromConfig() {
    let mongourl = `${this.config.protocol}://`
    if (this.config.username) mongourl += `${this.config.username}${this.config.password ? `:${this.config.password}` : ''}@`
    mongourl += `${this.config.host}${this.config.port ? `:${this.config.port}` : ''}/${this.config.authDatabase ? this.config.authDatabase : this.config.name}`
    if (this.config.connectionOptions) {
      // https://nodejs.org/api/url.html#url_new_urlsearchparams_obj this should be find but I got an complaint from TS
      const params = new URLSearchParams(this.config.connectionOptions)
      mongourl += `?${params}`
    }
    return mongourl
  }
}
