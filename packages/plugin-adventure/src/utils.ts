import { User, extendDatabase, Session } from 'koishi-core'
import MysqlDatabase from 'koishi-plugin-mysql'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'adventure/check'(session: Session<Adventurer.Field>, hints: string[]): void
    'adventure/rank'(name: string): [string, string]
    'adventure/text'(text: string, session: Session<Adventurer.Field>): string
    'adventure/use'(userId: number, progress: string): void
    'adventure/sell'(itemMap: Record<string, number>, session: Session<Shopper.Field>): string | undefined
    'adventure/lose'(itemMap: Record<string, number>, session: Session<Shopper.Field>, hints: string[]): void
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

export const showMap: Record<string, string | (() => string)> = {}
