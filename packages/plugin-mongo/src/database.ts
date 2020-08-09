import { MongoClient, Db, Collection } from 'mongodb'
import { App, User, Group } from 'koishi-core'

export interface Config {
  username?: string
  password?: string
  host?: string
  port?: number
  name?: string
  prefix?: string
}

interface Udoc extends User {
  _id: number
}
interface Gdoc extends Group {
  _id: number
}

export default class MongoDatabase {
  public client: MongoClient
  public db: Db

  user: Collection<Udoc>
  group: Collection<Gdoc>
  watcher: any

  constructor (public app: App, public config: Config) {
    this.config = config
  }

  async start () {
    let mongourl = 'mongodb://'
    if (this.config.username) mongourl += `${this.config.username}:${this.config.password}@`
    mongourl += `${this.config.host}:${this.config.port}/${this.config.name}`
    this.client = await MongoClient.connect(
      mongourl, { useNewUrlParser: true, useUnifiedTopology: true },
    )
    this.db = this.client.db(this.config.name)
    this.user = this.db.collection(this.config.prefix ? `${this.config.prefix}.user` : 'user')
    this.group = this.db.collection(this.config.prefix ? `${this.config.prefix}.group` : 'group')
  }

  stop () {
    return this.client.close()
  }
}
