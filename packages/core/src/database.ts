import * as utils from '@koishijs/utils'
import { Dict, MaybeArray } from '@koishijs/utils'
import { Database, Driver, Result, Update } from 'minato'
import { Context } from 'cordis'

declare module 'cordis' {
  interface Events {
    'model'(name: keyof Tables): void
  }

  interface Context {
    database: DatabaseService
    model: DatabaseService
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

export namespace DatabaseService {
  export interface Delegates {
    getSelfIds(type?: string, assignees?: string[]): Dict<string[]>
  }
}

export class DatabaseService extends Database<Tables> {
  constructor(protected ctx: Context) {
    super()

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
  }

  setDriver(name: string, driver: Driver) {
    super.setDriver(name, driver)
    if (Object.keys(this.drivers).length) {
      this.ctx.database = this
    } else {
      this.ctx.database = null
    }
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
      assignees ||= this.ctx.bots.filter(bot => bot.platform === type).map(bot => bot.selfId)
      return { [type]: assignees }
    }
    const platforms: Dict<string[]> = {}
    for (const bot of this.ctx.bots) {
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
}

// workaround typings
DatabaseService.prototype.extend = function extend(this: DatabaseService, name, fields, config) {
  Database.prototype.extend.call(this, name, fields, config)
  this.ctx.emit('model', name)
}

Context.service('database')
Context.service('model', {
  constructor: DatabaseService,
})
