import { User, Database, Context, Command, Argv, TableType, FieldCollector, defineEnumProperty } from 'koishi-core'
import {} from 'koishi-plugin-mysql'
import * as Koishi from 'koishi-core'
import Achievement from './achv'

function createCollector<T extends TableType>(key: T): FieldCollector<T, never, any[], { rest: string }> {
  return ({ tokens, session, options }, fields) => {
    if (tokens) {
      const index = tokens.findIndex(token => !token.quoted && token.content === '--')
      session.collect(key, { tokens: tokens.slice(index).slice(1) }, fields)
    } else {
      session.collect(key, Argv.parse(options.rest || ''), fields)
    }
  }
}

Command.prototype.useRest = function (this: Command) {
  return this
    .option('rest', '-- [command:text]  要执行的指令')
    .userFields(createCollector('user'))
    .channelFields(createCollector('channel'))
}

Command.prototype.useRank = function (this: Command) {
  this.config.usageName = 'rank'
  this.config.maxUsage = 20
  return this
    .option('global', '-g  使用全服数据')
    .option('length', '-l <index>  排名长度，默认为 10', { fallback: 10 })
    .option('threshold', '-t <value>  数据阈值')
}

declare module 'koishi-core' {
  interface Command<U, G, A, O> {
    useRest(): Command<U, G, A, O & { rest: string }>
    useRank(): Command<U, G, A, O>
  }

  interface EventMap {
    'adventure/check'(session: Adventurer.Session, hints: string[]): void
    'adventure/rank'(name: string): [string, string]
    'adventure/use'(userId: string, progress: string): void
    'adventure/before-sell'(itemMap: Record<string, number>, session: Adventurer.Session): string | undefined
    'adventure/before-use'(item: string, session: Adventurer.Session): string | undefined
    'adventure/before-timer'(name: string, reason: string, session: Adventurer.Session): string | undefined
    'adventure/lose'(itemMap: Record<string, number>, session: Adventurer.Session, hints: string[]): void
    'adventure/gain'(itemMap: Record<string, number>, session: Adventurer.Session, hints: string[]): void
    'adventure/ending'(session: Adventurer.Session, id: string, hints: string[]): void
    'adventure/achieve'(session: Session<Achievement.Field>, achv: Achievement, hints: string[]): void
  }

  interface User extends Adventurer {
    noSR: number
    affinity: number
    achvRank: number
    achvCount: number
  }

  namespace User {
    enum Flag {
      noLeading = 1 << 3
    }
  }
}

defineEnumProperty(User.Flag, 'noLeading', 1 << 3)

User.extend(() => ({
  noSR: 5,
  achievement: [],
  affinity: 0,
  wealth: 100,
  money: 100,
  gains: {},
  warehouse: {},
  luck: 0,
  taste: 0,
  recent: [],
  progress: '',
  phases: [],
  endings: {},
  drunkAchv: 0,
}))

Database.extend('koishi-plugin-mysql', ({ Domain, tables }) => {
  tables.user.gains = new Domain.Json()
  tables.user.endings = new Domain.Json()
  tables.user.warehouse = new Domain.Json()
  tables.user.achievement = new Domain.Array()
  tables.user.recent = new Domain.Array()
  tables.user.phases = new Domain.Array()
  tables.user.achvCount = () => 'list_length(`achievement`)'
})

type DeepReadonly<T> =
    T extends string | number | symbol | bigint ? T
  : T extends (...args: any[]) => any ? T
  : T extends [...args: infer R] ? readonly [...R]
  : { readonly [P in keyof T]: T[P] extends {} ? DeepReadonly<T[P]> : T[P] }

export interface Adventurer {
  id: string
  money: number
  wealth: number
  usage: Record<string, number>
  timers: Record<string, number>
  gains: Record<string, number>
  warehouse: Record<string, number>
  name: string
  flag: number
  luck: number
  taste: number
  recent: string[]
  progress: string
  phases: string[]
  endings: Record<string, number>
  drunkAchv: number
  achievement: string[]
}

export namespace Adventurer {
  export type Field = keyof Adventurer
  export type Session = Koishi.Session<Field>
  export type Observed<K extends Field = Field> = User.Observed<K>
  export type Readonly<K extends Field = Field> = Pick<DeepReadonly<Adventurer>, K>
  export type Infer<U, T = any> = [U] extends [(...args: any[]) => any] ? never : U | ((user: Readonly, state?: T) => U)
  export type Update<U, T = any> = [U] extends [(...args: any[]) => any] ? never : U | ((user: Observed, state?: T) => U)

  export const fields: Field[] = [
    'id', 'money', 'warehouse', 'wealth', 'timers', 'gains',
    'flag', 'luck', 'taste', 'recent', 'progress', 'phases',
    'endings', 'usage', 'drunkAchv', 'name', 'achievement',
  ]

  export function getValue<U, T>(source: Infer<U, T>, user: Adventurer.Readonly, state: T): U {
    return typeof source === 'function' ? (source as any)(user, state) : source
  }
}

export namespace Show {
  const data: Record<string, ShowRedirect | ShowCallback> = {}

  type ShowRedirect = ['redirect', string, ((user: Partial<User>, name: string) => boolean)?]
  type ShowCallback = ['callback', User.Field[], (user: Partial<User>, name: string) => string | undefined]

  export function redirect(name: string, command: string, callback?: ShowRedirect[2]) {
    data[name] = ['redirect', command, callback]
  }

  export function define<K extends User.Field = never>(name: string, callback: ShowCallback[2], fields: K[] = []) {
    data[name] = ['callback', fields, callback]
  }

  export function apply(ctx: Context) {
    const show = ctx.command('adv/show [name]', '查看图鉴', { maxUsage: 100 })
      .shortcut('查看', { fuzzy: true })
      .userFields(['usage'])
      .userFields((argv, fields) => {
        const target = argv.args.join('')
        argv.session.content = `show:${target}`
        const item = data[target]
        if (!item) return
        if (item[0] === 'redirect') {
          const command = ctx.command(item[1])
          argv.command = command as any
          argv.session.collect('user', argv, fields)
          argv.command = show
        } else if (item[0] === 'callback') {
          for (const field of item[1]) {
            fields.add(field)
          }
        }
      })
      .action(({ session, args, next }) => {
        const target = session.content.slice(5)
        if (!target) return '请输入要查看的图鉴名称。'
        const item = data[target]
        if (!item) return next(() => session.send(`你尚未解锁图鉴「${target}」。`))
        if (item[0] === 'redirect') {
          const result = item[2]?.(session.user, target)
          if (result) return next(() => session.send(`你尚未解锁图鉴「${target}」。`))
          const command = ctx.command(item[1])
          return command.execute({ command, session, args, options: { pass: true }, next })
        } else if (item[0] === 'callback') {
          const result = item[2]?.(session.user, target)
          return result || next(() => session.send(`你尚未解锁图鉴「${target}」。`))
        }
      })
  }
}
