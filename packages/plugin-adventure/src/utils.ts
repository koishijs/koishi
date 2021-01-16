import { User, extendDatabase, Session, Context, Command, Argv, TableType, FieldCollector } from 'koishi-core'
import MysqlDatabase from 'koishi-plugin-mysql'
import Achievement from './achievement'

declare module 'koishi-core/dist/command' {
  interface Command<U, G, O> {
    useRest(): Command<U, G, Extend<O, 'rest', string>>
    useRank(): Command<U, G, O>
  }
}

function createCollector<T extends TableType>(key: T): FieldCollector<T, never, { rest: string }> {
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
    .option('rest', '-- [command...]  要执行的指令', { type: 'string' })
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

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'adventure/check'(session: Session<Adventurer.Field>, hints: string[]): void
    'adventure/rank'(name: string): [string, string]
    'adventure/text'(text: string, session: Session<Adventurer.Field>): string
    'adventure/use'(userId: number, progress: string): void
    'adventure/before-sell'(itemMap: Record<string, number>, session: Session<Shopper.Field>): string | undefined
    'adventure/before-use'(item: string, session: Session<Adventurer.Field>): string | undefined
    'adventure/lose'(itemMap: Record<string, number>, session: Session<Shopper.Field>, hints: string[]): void
    'adventure/ending'(session: Session<Adventurer.Field>, id: string, hints: string[]): void
    'adventure/achieve'(session: Session<Achievement.Field>, achv: Achievement, hints: string[]): void
  }
}

declare module 'koishi-core/dist/database' {
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

((flags: Record<keyof typeof User.Flag, number>) => {
  flags[flags[1 << 3] = 'noLeading'] = 1 << 3
})(User.Flag)

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
  avatarAchv: 0,
  drunkAchv: 0,
}))

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', ({ DataType, tables }) => {
  tables.user.gains = new DataType.Json()
  tables.user.endings = new DataType.Json()
  tables.user.warehouse = new DataType.Json()
  tables.user.achievement = new DataType.Array()
  tables.user.recent = new DataType.Array()
  tables.user.phases = new DataType.Array()
  tables.user.achvCount = () => 'list_length(`achievement`)'
})

type InferFrom<T, R extends any[]> = T extends (...args: any[]) => any ? never : T | ((...args: R) => T)

type DeepReadonly<T> = T extends (...args: any[]) => any ? T
  : { readonly [P in keyof T]: T[P] extends {} ? DeepReadonly<T[P]> : T[P] }

export interface Shopper {
  id: number
  money: number
  wealth: number
  usage: Record<string, number>
  timers: Record<string, number>
  gains: Record<string, number>
  warehouse: Record<string, number>
}

export namespace Shopper {
  export type Field = keyof Shopper
}

export interface Adventurer extends Shopper {
  name: string
  flag: number
  luck: number
  taste: number
  recent: string[]
  progress: string
  phases: string[]
  endings: Record<string, number>
  avatarAchv: number
  drunkAchv: number
  achievement: string[]
}

export namespace Adventurer {
  export type Field = keyof Adventurer

  export type Infer<U, T extends User.Field = Adventurer.Field> = InferFrom<U, [User.Observed<T>]>

  export const fields: Field[] = [
    'id', 'money', 'warehouse', 'wealth', 'timers', 'gains',
    'flag', 'luck', 'taste', 'recent', 'progress', 'phases',
    'endings', 'usage', 'avatarAchv', 'drunkAchv', 'name', 'achievement',
  ]
}

export type ReadonlyUser = DeepReadonly<Adventurer>

export namespace ReadonlyUser {
  export type Infer<U, T extends Adventurer.Field = Adventurer.Field> = InferFrom<U, [Pick<ReadonlyUser, T>]>
}

export function getValue<U, T extends Adventurer.Field = Adventurer.Field>(source: ReadonlyUser.Infer<U, T>, user: Pick<ReadonlyUser, T>): U {
  return typeof source === 'function' ? (source as any)(user) : source
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
    ctx.command('adventure/show [name]', '查看图鉴', { maxUsage: 100 })
      .shortcut('查看', { fuzzy: true })
      .userFields(['usage'])
      .userFields((argv, fields) => {
        const target = argv.args.join('')
        argv.session.content = `show:${target}`
        const item = data[target]
        if (!item) return
        if (item[0] === 'redirect') {
          const command = argv.command = ctx.command(item[1])
          Object.assign(argv, command.parse(Argv.parse(argv.source.slice(5))))
          argv.session.collect('user', argv, fields)
        } else if (item[0] === 'callback') {
          for (const field of item[1]) {
            fields.add(field)
          }
        }
      })
      .action(({ session, args, next }) => {
        const target = session.content.slice(5)
        const item = data[target]
        if (!item) return next(() => session.$send(`未解锁图鉴「${target}」。`))
        if (item[0] === 'redirect') {
          const result = item[2]?.(session.$user, target)
          if (result) return next(() => session.$send(`未解锁图鉴「${target}」。`))
          return ctx.command(item[1]).execute({ session, args, options: { pass: true }, next })
        } else if (item[0] === 'callback') {
          const result = item[2]?.(session.$user, target)
          return result || next(() => session.$send(`未解锁图鉴「${target}」。`))
        }
      })
  }
}
