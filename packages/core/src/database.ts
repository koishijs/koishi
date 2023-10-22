import * as utils from '@koishijs/utils'
import { defineProperty, Dict, MaybeArray } from 'cosmokit'
import { Database, Driver, Update } from '@minatojs/core'
import { Context, Fragment, Schema, Universal } from '@satorijs/core'
import { Plugin } from './context'

declare module '@satorijs/core' {
  interface Events {
    'model'(name: keyof Tables): void
  }

  interface Context {
    database: DatabaseService
    model: DatabaseService
    getSelfIds(type?: string, assignees?: string[]): Dict<string[]>
    broadcast(content: Fragment, forced?: boolean): Promise<string[]>
    broadcast(channels: readonly string[], content: Fragment, forced?: boolean): Promise<string[]>
  }
}

export interface User {
  id: number
  name: string
  /** @deprecated */
  flag: number
  authority: number
  locales: string[]
  permissions: string[]
  createdAt: Date
}

export namespace User {
  export enum Flag {
    ignore = 1,
  }

  export type Field = keyof User
  export type Observed<K extends Field = Field> = utils.Observed<Pick<User, K>, Promise<void>>
}

export interface Binding {
  aid: number
  bid: number
  pid: string
  platform: string
}

export interface Channel {
  id: string
  platform: string
  /** @deprecated */
  flag: number
  assignee: string
  guildId: string
  locales: string[]
  permissions: string[]
}

export namespace Channel {
  export enum Flag {
    ignore = 1,
    silent = 4,
  }

  export type Field = keyof Channel
  export type Observed<K extends Field = Field> = utils.Observed<Pick<Channel, K>, Promise<void>>
}

export interface Tables {
  user: User
  binding: Binding
  channel: Channel
}

export class DatabaseService extends Database<Tables> {
  static readonly methods = ['getSelfIds', 'broadcast']

  constructor(protected app: Context) {
    super()
    defineProperty(this, Context.current, app)

    this.extend('user', {
      id: 'unsigned(20)',
      name: { type: 'string', length: 255 },
      flag: 'unsigned(20)',
      authority: 'unsigned(4)',
      locales: 'list(255)',
      permissions: 'list',
      createdAt: 'timestamp',
    }, {
      autoInc: true,
      unique: ['name'],
    })

    this.extend('binding', {
      aid: 'unsigned(20)',
      bid: 'unsigned(20)',
      pid: 'string(255)',
      platform: 'string(255)',
    }, {
      primary: ['pid', 'platform'],
    })

    this.extend('channel', {
      id: 'string(255)',
      platform: 'string(255)',
      flag: 'unsigned(20)',
      assignee: 'string(255)',
      guildId: 'string(255)',
      locales: 'list(255)',
      permissions: 'list',
    }, {
      primary: ['id', 'platform'],
    })

    app.on('login-added', ({ platform }) => {
      if (platform in this.tables.user.fields) return
      this.migrate('user', { [platform]: 'string(255)' }, async (db) => {
        const users = await db.get('user', { [platform]: { $exists: true } }, ['id', platform as never])
        await db.upsert('binding', users.filter(u => u[platform]).map((user) => ({
          aid: user.id,
          bid: user.id,
          pid: user[platform],
          platform,
        })))
      })
    })
  }

  async getUser<K extends User.Field>(platform: string, pid: string, modifier?: Driver.Cursor<K>): Promise<Pick<User, K>> {
    const [binding] = await this.get('binding', { platform, pid }, ['aid'])
    if (!binding) return
    const [user] = await this.get('user', { id: binding.aid }, modifier)
    return user
  }

  async setUser(platform: string, pid: string, data: Update<User>) {
    const [binding] = await this.get('binding', { platform, pid }, ['aid'])
    if (!binding) throw new Error('user not found')
    return this.set('user', binding.aid, data)
  }

  async createUser(platform: string, pid: string, data: Partial<User>) {
    const user = await this.create('user', data)
    await this.create('binding', { aid: user.id, bid: user.id, pid, platform })
    return user
  }

  getChannel<K extends Channel.Field>(platform: string, id: string, modifier?: Driver.Cursor<K>): Promise<Pick<Channel, K | 'id' | 'platform'>>
  getChannel<K extends Channel.Field>(platform: string, ids: string[], modifier?: Driver.Cursor<K>): Promise<Pick<Channel, K>[]>
  async getChannel(platform: string, id: MaybeArray<string>, modifier?: Driver.Cursor<Channel.Field>) {
    const data = await this.get('channel', { platform, id }, modifier)
    if (Array.isArray(id)) return data
    if (data[0]) Object.assign(data[0], { platform, id })
    return data[0]
  }

  getSelfIds(type?: string, assignees?: string[]): Dict<string[]> {
    if (type) {
      assignees ||= this.app.bots.filter(bot => bot.platform === type).map(bot => bot.selfId)
      return { [type]: assignees }
    }
    const platforms: Dict<string[]> = {}
    for (const bot of this.app.bots) {
      (platforms[bot.platform] ||= []).push(bot.selfId)
    }
    return platforms
  }

  getAssignedChannels<K extends Channel.Field>(fields?: K[], assignMap?: Dict<string[]>): Promise<Pick<Channel, K>[]>
  async getAssignedChannels(fields?: Channel.Field[], assignMap: Dict<string[]> = this.getSelfIds()) {
    return this.get('channel', {
      $or: Object.entries(assignMap).map(([platform, assignee]) => ({ platform, assignee })),
    }, fields)
  }

  setChannel(platform: string, id: string, data: Update<Channel>) {
    return this.set('channel', { platform, id }, data)
  }

  createChannel(platform: string, id: string, data: Partial<Channel>) {
    return this.create('channel', { platform, id, ...data })
  }

  async broadcast(...args: [Fragment, boolean?] | [readonly string[], Fragment, boolean?]) {
    let channels: string[]
    if (Array.isArray(args[0])) channels = args.shift() as any
    const [content, forced] = args as [Fragment, boolean]
    if (!content) return []

    const data = await this.getAssignedChannels(['id', 'assignee', 'flag', 'platform', 'guildId', 'locales'])
    const assignMap: Dict<Dict<Pick<Channel, 'id' | 'guildId' | 'locales'>[]>> = {}
    for (const channel of data) {
      const { platform, id, assignee, flag } = channel
      if (channels && !channels.includes(`${platform}:${id}`)) continue
      if (!forced && (flag & Channel.Flag.silent)) continue
      ((assignMap[platform] ||= {})[assignee] ||= []).push(channel)
    }

    return (await Promise.all(this.app.bots.map((bot) => {
      const targets = assignMap[bot.platform]?.[bot.selfId]
      if (!targets) return Promise.resolve([])
      const sessions = targets.map(({ id, guildId, locales }) => {
        const session = bot.session({
          type: 'message',
          channel: { id, type: Universal.Channel.Type.TEXT },
          guild: { id: guildId },
        })
        session.locales = locales
        return session
      })
      return bot.broadcast(sessions, content)
    }))).flat(1)
  }
}

// workaround typings
DatabaseService.prototype.extend = function extend(this: DatabaseService, name, fields, config) {
  Database.prototype.extend.call(this, name, fields, {
    ...config,
    // driver: this[Context.current].mapping.database,
  })
  this.app.emit('model', name)
}

Context.service('database')
Context.service('model', DatabaseService)

export const defineDriver = <T>(constructor: Driver.Constructor<T>, schema?: Schema, prepare?: Plugin.Function<T>): Plugin.Object<T> => ({
  name: constructor.name,
  reusable: true,
  Config: schema,
  filter: false,
  async apply(ctx, config) {
    config = { ...config }
    await prepare?.(ctx, config)
    const driver = new constructor(ctx.model, config)
    const key = 'default'

    ctx.on('ready', async () => {
      await driver.start()
      ctx.model.drivers[key] = driver
      ctx.model.refresh()
      const database = Object.create(ctx.model)
      ctx.database = database
    })

    ctx.on('dispose', async () => {
      ctx.database = null
      delete ctx.model.drivers[key]
      await driver.stop()
    })
  },
})
