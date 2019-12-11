import { isSubset, union, intersection, difference } from 'koishi-utils'
import { MessageMeta, Meta, contextTypes } from './meta'
import { Command, CommandConfig } from './command'
import { EventEmitter } from 'events'
import { Sender } from './sender'
import { App } from './app'
import { Database } from './database'
import * as messages from './messages'
import * as errors from './errors'

export type NextFunction = (next?: NextFunction) => any
export type Middleware = (meta: MessageMeta, next: NextFunction) => any

type PluginFunction <T extends Context, U> = (ctx: T, options: U) => void
type PluginObject <T extends Context, U> = { name?: string, apply: PluginFunction<T, U> }
export type Plugin <T extends Context = Context, U = any> = PluginFunction<T, U> | PluginObject<T, U>

type Subscope = [number[], number[]]
export type ContextScope = Subscope[]

export namespace ContextScope {
  export function stringify (scope: ContextScope) {
    return scope.map(([include, exclude], index) => {
      const type = contextTypes[index]
      const sign = include ? '+' : '-'
      const idList = include || exclude
      return `${sign}${type}:${idList.join(',')}`
    }).filter(a => a).join(';')
  }

  export function parse (identifier: string) {
    const scope = noopScope.slice()
    identifier.split(';').forEach((segment) => {
      const capture = /^([+-])(user|group|discuss):(.+)$/.exec(segment)
      if (!capture) throw new Error(errors.INVALID_IDENTIFIER)
      const [_, sign, type, list] = capture
      const idList = list.split(',').map(n => +n)
      scope[contextTypes[type]] = sign === '+' ? [idList, null] : [null, idList]
    })
    return scope
  }
}

const noopScope: ContextScope = [[[], null], [[], null], [[], null]]
const noopIdentifier = ContextScope.stringify(noopScope)

export class Context {
  public app: App
  public sender: Sender
  public database: Database
  public receiver = new EventEmitter()

  constructor (public readonly identifier: string, private readonly _scope: ContextScope) {}

  inverse () {
    return this.app._createContext(this._scope.map(([include, exclude]) => {
      return include ? [null, include.slice()] : [exclude.slice(), []]
    }))
  }

  plus (ctx: Context) {
    return this.app._createContext(this._scope.map(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? include2 ? [union(include1, include2), null] : [null, difference(exclude2, include1)]
        : [null, include2 ? difference(exclude1, include2) : intersection(exclude1, exclude2)]
    }))
  }

  minus (ctx: Context) {
    return this.app._createContext(this._scope.map(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? [include2 ? difference(include1, include2) : intersection(include1, exclude2), null]
        : include2 ? [null, union(include2, exclude1)] : [difference(exclude2, exclude1), null]
    }))
  }

  intersect (ctx: Context) {
    return this.app._createContext(this._scope.map(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? [include2 ? intersection(include1, include2) : difference(include1, exclude2), null]
        : include2 ? [difference(include2, exclude1), null] : [null, union(exclude1, exclude2)]
    }))
  }

  match (meta: Meta) {
    const [include, exclude] = this._scope[+contextTypes[meta.$type]]
    return include ? include.includes(meta.$subId) : !exclude.includes(meta.$subId)
  }

  contain (ctx: Context) {
    return this._scope.every(([include1, exclude1], index) => {
      const [include2, exclude2] = ctx._scope[index]
      return include1
        ? include2 && isSubset(include2, include1)
        : include2 ? !intersection(include2, exclude1).length : isSubset(exclude1, exclude2)
    })
  }

  plugin <U> (plugin: PluginFunction<this, U>, options?: U): this
  plugin <U> (plugin: PluginObject<this, U>, options?: U): this
  plugin <U> (plugin: Plugin<this, U>, options: any) {
    if (options === false) return
    const app = Object.create(this)
    if (typeof plugin === 'function') {
      plugin(app, options)
    } else if (plugin && typeof plugin === 'object' && typeof plugin.apply === 'function') {
      plugin.apply(app, options)
      if ('name' in plugin) {
        this.app.receiver.emit('plugin', plugin.name)
      }
    }
    return this
  }

  middleware (middleware: Middleware) {
    this.app._middlewares.push([this, middleware])
    return this
  }

  premiddleware (middleware: Middleware) {
    this.app._middlewares.unshift([this, middleware])
    return this
  }

  removeMiddleware (middleware: Middleware) {
    const index = this.app._middlewares.findIndex(([c, m]) => c === this && m === middleware)
    if (index >= 0) {
      this.app._middlewares.splice(index, 1)
      return true
    }
  }

  command (rawName: string, config?: CommandConfig): Command
  command (rawName: string, description: string, config?: CommandConfig): Command
  command (rawName: string, ...args: [CommandConfig?] | [string, CommandConfig?]) {
    const description = typeof args[0] === 'string' ? args.shift() as string : undefined
    const config = { description, ...args[0] as CommandConfig }
    const [path] = rawName.split(' ', 1)
    const declaration = rawName.slice(path.length)

    let parent: Command = null
    path.toLowerCase().split(/(?=[\\./])/).forEach((segment) => {
      const code = segment.charCodeAt(0)
      const name = code === 46 ? parent.name + segment : code === 47 ? segment.slice(1) : segment
      let command = this.app._commandMap[name]
      if (command) {
        if (parent) {
          if (command === parent) {
            throw new Error(errors.INVALID_SUBCOMMAND)
          }
          if (command.parent) {
            if (command.parent !== parent) {
              throw new Error(errors.INVALID_SUBCOMMAND)
            }
          } else if (parent.context.contain(command.context)) {
            command.parent = parent
            parent.children.push(command)
          } else {
            throw new Error(errors.INVALID_CONTEXT)
          }
        }
        return parent = command
      }
      const context = parent ? this.intersect(parent.context) : this
      if (context.identifier === noopIdentifier) {
        throw new Error(errors.INVALID_CONTEXT)
      }
      command = new Command(name, declaration, context)
      if (parent) {
        command.parent = parent
        parent.children.push(command)
      }
      parent = command
    })

    Object.assign(parent.config, config)
    return parent
  }

  private _getCommandByRawName (name: string) {
    name = name.split(' ', 1)[0]
    const index = name.lastIndexOf('/')
    return this.app._commandMap[name.slice(index + 1).toLowerCase()]
  }

  getCommand (name: string, meta: MessageMeta) {
    const command = this._getCommandByRawName(name)
    return command && command.context.match(meta) && command
  }

  runCommand (name: string, meta: MessageMeta, args: string[] = [], options: Record<string, any> = {}, rest = '') {
    const command = this._getCommandByRawName(name)
    if (!command || !command.context.match(meta)) {
      return meta.$send(messages.COMMAND_NOT_FOUND)
    }
    return command.execute({ meta, command, args, options, rest, unknown: [] })
  }

  end () {
    return this.app
  }
}

type UserMessageEvent = 'message' | 'message/friend' | 'message/group' | 'message/discuss' | 'message/other'
type GroupMessageEvent = 'message' | 'message/normal' | 'message/notice' | 'message/anonymous'
type DiscussMessageEvent = 'message'
type UserNoticeEvent = 'friend_add'
type GroupNoticeEvent = 'group_increase' | 'group_increase/approve' | 'group_increase/invite'
  | 'group_decrease' | 'group_decrease/leave' | 'group_decrease/kick' | 'group_decrease/kick_me'
  | 'group_upload' | 'group_admin' | 'group_admin/unset' | 'group_admin/set' | 'group_ban'
type UserRequestEvent = 'request'
type GroupRequestEvent = 'request' | 'request/add' | 'request/invite'

export type MessageEvent = UserMessageEvent | GroupMessageEvent | DiscussMessageEvent
export type NoticeEvent = UserNoticeEvent | GroupNoticeEvent
export type RequestEvent = UserRequestEvent | GroupRequestEvent
export type MetaEventEvent = 'meta_event' | 'meta_event/heartbeat'
  | 'meta_event/lifecycle' | 'meta_event/lifecycle/enable' | 'meta_event/lifecycle/disable'

interface UserReceiver extends EventEmitter {
  on (event: 'send', listener: (meta: Meta<'send'>) => any): this
  on (event: UserNoticeEvent, listener: (meta: Meta<'notice'>) => any): this
  on (event: UserMessageEvent, listener: (meta: Meta<'message'>) => any): this
  on (event: UserRequestEvent, listener: (meta: Meta<'request'>) => any): this
  once (event: 'send', listener: (meta: Meta<'send'>) => any): this
  once (event: UserNoticeEvent, listener: (meta: Meta<'notice'>) => any): this
  once (event: UserMessageEvent, listener: (meta: Meta<'message'>) => any): this
  once (event: UserRequestEvent, listener: (meta: Meta<'request'>) => any): this
}

interface GroupReceiver extends EventEmitter {
  on (event: 'send', listener: (meta: Meta<'send'>) => any): this
  on (event: GroupNoticeEvent, listener: (meta: Meta<'notice'>) => any): this
  on (event: GroupMessageEvent, listener: (meta: Meta<'message'>) => any): this
  on (event: GroupRequestEvent, listener: (meta: Meta<'request'>) => any): this
  once (event: 'send', listener: (meta: Meta<'send'>) => any): this
  once (event: GroupNoticeEvent, listener: (meta: Meta<'notice'>) => any): this
  once (event: GroupMessageEvent, listener: (meta: Meta<'message'>) => any): this
  once (event: GroupRequestEvent, listener: (meta: Meta<'request'>) => any): this
}

export interface DiscussReceiver extends EventEmitter {
  on (event: 'send', listener: (meta: Meta<'send'>) => any): this
  on (event: DiscussMessageEvent, listener: (meta: Meta<'message'>) => any): this
  once (event: 'send', listener: (meta: Meta<'send'>) => any): this
  once (event: DiscussMessageEvent, listener: (meta: Meta<'message'>) => any): this
}

export interface UserContext extends Context {
  receiver: UserReceiver
}

export interface GroupContext extends Context {
  receiver: GroupReceiver
}

export interface DiscussContext extends Context {
  receiver: DiscussReceiver
}
