import * as utils from '@koishijs/utils'
import { Awaitable, Dict, MaybeArray } from '@koishijs/utils'
import { Database, Driver, Result, Update } from 'cosmotype'
import { Context } from './context'
import ns from 'ns-require'

export interface User {
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

export abstract class Service {
  protected start(): Awaitable<void> {}
  protected stop(): Awaitable<void> {}

  constructor(protected ctx: Context, public name: keyof Context.Services, public immediate?: boolean) {
    Context.service(name)

    ctx.on('ready', async () => {
      await this.start()
      ctx[name] = this as never
    })

    ctx.on('dispose', async () => {
      if (ctx[name] === this as never) ctx[name] = null
      await this.stop()
    })
  }

  get caller(): Context {
    return this[Context.current] || this.ctx
  }
}

export class DatabaseService extends Database<Tables> {
  constructor(protected ctx: Context) {
    super()

    this.extend('user', {
      id: 'string(63)',
      name: 'string(63)',
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

  getAssignedChannels<K extends Channel.Field>(fields?: K[], assignMap?: Dict<string[]>): Promise<Result<Channel, K>[]>
  async getAssignedChannels(fields?: Channel.Field[], assignMap: Dict<string[]> = this.ctx.getSelfIds()) {
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

export const scope = ns({
  namespace: 'koishi',
  prefix: 'plugin',
  official: 'koishijs',
})

export namespace DatabaseService {
  type Methods<S, T> = {
    [K in keyof S]?: S[K] extends (...args: infer R) => infer U ? (this: T, ...args: R) => U : S[K]
  }

  type Constructor<T> = new (...args: any[]) => T
  type ExtensionMethods<T> = Methods<DatabaseService, T extends Constructor<infer I> ? I : never>
  type Extension<T> = ((Database: T) => void) | ExtensionMethods<T>

  /** @deprecated */
  export function extend(module: string, extension: any): void
  export function extend<T extends Constructor<unknown>>(module: T, extension: Extension<T>): void
  export function extend(module: any, extension: any) {
    let Database: any
    try {
      Database = typeof module === 'string' ? scope.require(module) : module
    } catch {}
    if (!Database) return

    if (typeof extension === 'function') {
      extension(Database)
    } else {
      Object.assign(Database.prototype, extension)
    }
  }
}
