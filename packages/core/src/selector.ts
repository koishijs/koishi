import { Dict, Logger, remove } from '@koishijs/utils'
import { Context, Events } from 'cordis'
import { Channel } from './database'
import { Session } from './protocol/session'

declare module 'cordis' {
  interface Context extends SelectorService.Delegates {
    $selector: SelectorService
  }

  namespace Context {
    interface Meta {
      filter: Filter
    }
  }
}

export type Filter = (session: Session) => boolean

export namespace SelectorService {
  export interface Delegates {
    logger(name: string): Logger
    any(): Context
    never(): Context
    union(arg: Filter | Context): Context
    intersect(arg: Filter | Context): Context
    exclude(arg: Filter | Context): Context
    user(...values: string[]): Context
    self(...values: string[]): Context
    guild(...values: string[]): Context
    channel(...values: string[]): Context
    platform(...values: string[]): Context
    private(...values: string[]): Context
    select(options: Selection): Context
    before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append?: boolean): () => boolean
    setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
    broadcast(content: string, forced?: boolean): Promise<string[]>
    broadcast(channels: readonly string[], content: string, forced?: boolean): Promise<string[]>
  }
}

type OmitSubstring<S extends string, T extends string> = S extends `${infer L}${T}${infer R}` ? `${L}${R}` : never
type BeforeEventName = OmitSubstring<keyof Events & string, 'before-'>

export type BeforeEventMap = { [E in keyof Events & string as OmitSubstring<E, 'before-'>]: Events[E] }

function property<K extends keyof Session>(ctx: Context, key: K, ...values: Session[K][]) {
  return ctx.intersect((session: Session) => {
    return values.length ? values.includes(session[key]) : !!session[key]
  })
}

export class SelectorService {
  constructor(private app: Context) {
    app.filter = () => true

    app.on('internal/warning', (format, ...args) => {
      this.logger('app').warn(format, ...args)
    })

    app.on('internal/runtime', (runtime) => {
      if (!runtime.uid) return
      runtime.context.filter = (session) => {
        return runtime.children.some(p => p.context.filter(session))
      }
    })
  }

  protected get caller(): Context {
    return this[Context.current] || this.app
  }

  any() {
    return this.caller.extend({ filter: () => true })
  }

  never() {
    return this.caller.extend({ filter: () => false })
  }

  union(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) || filter(s) })
  }

  intersect(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) && filter(s) })
  }

  exclude(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) && !filter(s) })
  }

  logger(name: string) {
    return new Logger(name)
  }

  user(...values: string[]) {
    return property(this.caller, 'userId', ...values)
  }

  self(...values: string[]) {
    return property(this.caller, 'selfId', ...values)
  }

  guild(...values: string[]) {
    return property(this.caller, 'guildId', ...values)
  }

  channel(...values: string[]) {
    return property(this.caller, 'channelId', ...values)
  }

  platform(...values: string[]) {
    return property(this.caller, 'platform', ...values)
  }

  private(...values: string[]) {
    return property(this.caller.exclude(property(this.caller, 'guildId')), 'userId', ...values)
  }

  before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append = false) {
    const seg = (name as string).split('/')
    seg[seg.length - 1] = 'before-' + seg[seg.length - 1]
    return this.caller.on(seg.join('/') as keyof Events, listener, !append)
  }

  private createTimerDispose(timer: NodeJS.Timeout) {
    const dispose = () => {
      clearTimeout(timer)
      if (!this.caller.state) return
      return remove(this.caller.state.disposables, dispose)
    }
    this.caller.state.disposables.push(dispose)
    return dispose
  }

  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    const dispose = this.createTimerDispose(setTimeout(() => {
      dispose()
      callback()
    }, ms, ...args))
    return dispose
  }

  setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    return this.createTimerDispose(setInterval(callback, ms, ...args))
  }

  async broadcast(...args: [string, boolean?] | [readonly string[], string, boolean?]) {
    let channels: string[]
    if (Array.isArray(args[0])) channels = args.shift() as any
    const [content, forced] = args as [string, boolean]
    if (!content) return []

    const data = await this.caller.database.getAssignedChannels(['id', 'assignee', 'flag', 'platform', 'guildId'])
    const assignMap: Dict<Dict<[string, string][]>> = {}
    for (const { id, assignee, flag, platform, guildId } of data) {
      if (channels && !channels.includes(`${platform}:${id}`)) continue
      if (!forced && (flag & Channel.Flag.silent)) continue
      ((assignMap[platform] ||= {})[assignee] ||= []).push([id, guildId])
    }

    return (await Promise.all(Object.entries(assignMap).flatMap(([platform, map]) => {
      return this.caller.bots.map((bot) => {
        if (bot.platform !== platform) return Promise.resolve([])
        return bot.broadcast(map[bot.selfId] || [], content)
      })
    }))).flat(1)
  }
}

Context.service('$selector', {
  constructor: SelectorService,
  methods: [
    'any', 'never', 'union', 'intersect', 'exclude', 'select',
    'user', 'self', 'guild', 'channel', 'platform', 'private',
    'before', 'logger', 'setTimeout', 'setInterval', 'broadcast',
  ],
})
