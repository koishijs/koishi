import { Dict, Logger, makeArray, MaybeArray, remove } from '@koishijs/utils'
import { Context } from 'cordis'
import { Channel } from './database'
import { Session } from './protocol/session'

declare module 'cordis' {
  interface Context extends Selector.Delegates {
    $selector: Selector
  }
}

const selectors = ['user', 'guild', 'channel', 'self', 'private', 'platform'] as const

export type SelectorType = typeof selectors[number]
export type SelectorValue = boolean | MaybeArray<string | number>
export type BaseSelection = { [K in SelectorType as `$${K}`]?: SelectorValue }

interface Selection extends BaseSelection {
  $and?: Selection[]
  $or?: Selection[]
  $not?: Selection
}

export namespace Selector {
  export interface Delegates {
    logger(name: string): Logger
    user(...values: string[]): Context
    self(...values: string[]): Context
    guild(...values: string[]): Context
    channel(...values: string[]): Context
    platform(...values: string[]): Context
    private(...values: string[]): Context
    select(options: Selection): Context
    setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
    broadcast(content: string, forced?: boolean): Promise<string[]>
    broadcast(channels: readonly string[], content: string, forced?: boolean): Promise<string[]>
  }
}

function property<K extends keyof Session>(ctx: Context, key: K, ...values: Session[K][]) {
  return ctx.intersect((session: Session) => {
    return values.length ? values.includes(session[key]) : !!session[key]
  })
}

export class Selector {
  constructor(private ctx: Context) {
    ctx.on('logger/error', (name, ...args) => {
      this.logger(name).error(...args)
    })
    ctx.on('logger/warn', (name, ...args) => {
      this.logger(name).warn(...args)
    })
    ctx.on('logger/debug', (name, ...args) => {
      this.logger(name).debug(...args)
    })
  }

  protected get caller(): Context {
    return this[Context.current] || this.ctx
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

  select(options: Selection) {
    let ctx: Context = this.caller

    // basic selectors
    for (const type of selectors) {
      const value = options[`$${type}`] as SelectorValue
      if (value === true) {
        ctx = ctx[type]()
      } else if (value === false) {
        ctx = ctx.exclude(ctx[type]())
      } else if (value !== undefined) {
        // we turn everything into string
        ctx = ctx[type](...makeArray(value).map(item => '' + item))
      }
    }

    // intersect
    if (options.$and) {
      for (const selection of options.$and) {
        ctx = ctx.intersect(this.select(selection))
      }
    }

    // union
    if (options.$or) {
      let ctx2: Context = this.caller
      for (const selection of options.$or) {
        ctx2 = ctx2.union(this.select(selection))
      }
      ctx = ctx.intersect(ctx2)
    }

    // exclude
    if (options.$not) {
      ctx = ctx.exclude(this.select(options.$not))
    }

    return ctx
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
  constructor: Selector,
  methods: ['logger', 'user', 'self', 'guild', 'channel', 'platform', 'private', 'select', 'setTimeout', 'setInterval', 'broadcast'],
})
