import { User, extendDatabase, Session, NextFunction, Command, checkTimer } from 'koishi-core'
import MysqlDatabase from 'koishi-plugin-mysql'
import Affinity from './affinity'
import Item from './item'

declare module 'koishi-core/dist/command' {
  interface Command<U, G, O> {
    checkTimer(name: string): Command<U | 'timers', G, O>
  }
}

Command.prototype.checkTimer = function (this: Command, name) {
  return this.userFields(['timers']).before(({ $user }) => checkTimer(name, $user))
}

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'rank'(name: string): [string, string]
  }
}

declare module 'koishi-core/dist/database' {
  interface User extends Adventurer {
    noSR: number
    affinity: number
    titles: Affinity[]
    achvRank: number
    achvS: number
    achvH: number
  }

  namespace User {
    enum Flag {
      noLeading = 1 << 6
    }
  }
}

((flags: Record<keyof typeof User.Flag, number>) => {
  flags[flags[1 << 6] = 'noLeading'] = 1 << 6
})(User.Flag)

User.extend(() => ({
  noSR: 5,
  titles: [],
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

export const achvS = 'list_length(`achievement`)'
export const achvH = '(LENGTH(`achievement`) - LENGTH(REPLACE(`achievement`, "-ex" ,""))) / 3'

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', ({ DataType, tables }) => {
  tables.user.titles = new DataType.Json()
  tables.user.gains = new DataType.Json()
  tables.user.endings = new DataType.Json()
  tables.user.warehouse = new DataType.Json()
  tables.user.achievement = new DataType.Array()
  tables.user.recent = new DataType.Array()
  tables.user.phases = new DataType.Array()
  tables.user.achvS = () => achvS
  tables.user.achvH = () => achvH
})

type InferFrom<T, R extends any[]> = T extends (...args: any[]) => any ? never : T | ((...args: R) => T)

type DeepReadonly<T> = T extends (...args: any[]) => any ? T
  : { readonly [P in keyof T]: T[P] extends {} ? DeepReadonly<T[P]> : T[P] }

export interface Shopper {
  id: number
  money: number
  wealth: number
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
  usage: Record<string, number>
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

export function showItemSuggestions(command: string, session: Session, args: string[], index: number, next: NextFunction) {
  args = args.slice()
  return session.$suggest({
    next,
    target: args[index],
    items: Item.data.map(item => item.name),
    prefix: `没有物品“${args[index]}”。`,
    suffix: '发送空行或句号以使用推测的物品。',
    async apply(suggestion, next) {
      args.splice(index, 1, suggestion)
      return session.$execute({ command, args, next })
    },
  })
}
