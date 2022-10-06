import * as utils from '@koishijs/utils'
import { defineProperty, Dict, MaybeArray } from '@koishijs/utils'
import { Database, Driver, Result, Update } from '@minatojs/core'
import { segment } from '@satorijs/core'
import { Context, Plugin } from './context'

declare module './context' {
  interface Events {
    'model'(name: keyof Tables): void
  }

  interface Context {
    database: DatabaseService
    model: DatabaseService
    getSelfIds(type?: string, assignees?: string[]): Dict<string[]>
    broadcast(content: string | segment, forced?: boolean): Promise<string[]>
    broadcast(channels: readonly string[], content: string | segment, forced?: boolean): Promise<string[]>
  }
}

export interface User {
  // TODO v5: change to number
  id: string
  flag: number
  authority: number
  name: string
  locale: string
}

export namespace User {
  export enum Flag {
    ignore = 1,
  }

  export type Field = keyof User
  export const fields: Field[] = []
  export type Observed<K extends Field = Field> = utils.Observed<Pick<User, K>, Promise<void>>
}

export interface Channel {
  id: string
  platform: string
  flag: number
  assignee: string
  guildId: string
  locale: string
}

export namespace Channel {
  export enum Flag {
    ignore = 1,
    silent = 4,
  }

  export type Field = keyof Channel
  export const fields: Field[] = []
  export type Observed<K extends Field = Field> = utils.Observed<Pick<Channel, K>, Promise<void>>
}

export interface Tables {
  user: User
  channel: Channel
}

export class DatabaseService extends Database<Tables> {
  static readonly methods = ['getSelfIds', 'broadcast']

  constructor(protected app: Context) {
    super()
    defineProperty(this, Context.current, app)

    this.extend('user', {
      // TODO v5: change to number
      id: 'string(63)',
      name: { type: 'string', length: 63 },
      flag: 'unsigned(20)',
      authority: 'unsigned(4)',
      locale: 'string(63)',
    }, {
      autoInc: true,
    })

    this.extend('channel', {
      id: 'string(63)',
      platform: 'string(63)',
      flag: 'unsigned(20)',
      assignee: 'string(63)',
      guildId: 'string(63)',
      locale: 'string(63)',
    }, {
      primary: ['id', 'platform'],
    })

    app.on('bot-added', (bot) => {
      if (bot.platform in this.tables.user.fields) return
      this.extend('user', {
        [bot.platform]: { type: 'string', length: 63 },
      }, {
        unique: [bot.platform as never],
      })
    })
  }

  getUser<T extends string, K extends User.Field>(platform: T, id: string, modifier?: Driver.Cursor<K>): Promise<Result<User, K> & Record<T, string>>
  getUser<T extends string, K extends User.Field>(platform: T, ids: string[], modifier?: Driver.Cursor<K>): Promise<Result<User, K>[]>
  async getUser(platform: string, id: MaybeArray<string>, modifier?: Driver.Cursor<User.Field>) {
    const data = await this.get('user', { [platform]: id }, modifier)
    if (Array.isArray(id)) return data
    if (data[0]) Object.assign(data[0], { [platform]: id })
    return data[0] as any
  }

  setUser(platform: string, id: string, data: Update<User>) {
    return this.set('user', { [platform]: id }, data)
  }

  createUser(platform: string, id: string, data: Partial<User>) {
    return this.create('user', { [platform]: id, ...data })
  }

  getChannel<K extends Channel.Field>(platform: string, id: string, modifier?: Driver.Cursor<K>): Promise<Result<Channel, K | 'id' | 'platform'>>
  getChannel<K extends Channel.Field>(platform: string, ids: string[], modifier?: Driver.Cursor<K>): Promise<Result<Channel, K>[]>
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

  getAssignedChannels<K extends Channel.Field>(fields?: K[], assignMap?: Dict<string[]>): Promise<Result<Channel, K>[]>
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

  async broadcast(...args: [string | segment, boolean?] | [readonly string[], string | segment, boolean?]) {
    let channels: string[]
    if (Array.isArray(args[0])) channels = args.shift() as any
    const [content, forced] = args as [string | segment, boolean]
    if (!content) return []

    const data = await this.getAssignedChannels(['id', 'assignee', 'flag', 'platform', 'guildId'])
    const assignMap: Dict<Dict<[string, string][]>> = {}
    for (const { id, assignee, flag, platform, guildId } of data) {
      if (channels && !channels.includes(`${platform}:${id}`)) continue
      if (!forced && (flag & Channel.Flag.silent)) continue
      ((assignMap[platform] ||= {})[assignee] ||= []).push([id, guildId])
    }

    return (await Promise.all(Object.entries(assignMap).flatMap(([platform, map]) => {
      return this.app.bots.map((bot) => {
        if (bot.platform !== platform) return Promise.resolve([])
        return bot.broadcast(map[bot.selfId] || [], content)
      })
    }))).flat(1)
  }
}

// workaround typings
DatabaseService.prototype.extend = function extend(this: DatabaseService, name, fields, config) {
  Database.prototype.extend.call(this, name, fields, {
    ...config,
    driver: this[Context.current].mapping.database,
  })
  this.app.emit('model', name)
}

Context.service('database')
Context.service('model', DatabaseService)

export const defineDriver = <T>(constructor: Driver.Constructor<T>, schema?: utils.Schema, prepare?: Plugin.Function<T>): Plugin.Object<T> => ({
  name: constructor.name,
  reusable: true,
  Config: schema,
  apply(ctx, config) {
    config = { ...config }
    prepare?.(ctx, config)
    const driver = new constructor(ctx.model, config)
    const key = ctx.mapping.database || 'default'

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
