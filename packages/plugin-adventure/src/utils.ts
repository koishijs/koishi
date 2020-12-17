import { User, extendDatabase, Context } from 'koishi-core'
import Affinity from './affinity'
import type MysqlDatabase from 'koishi-plugin-mysql'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'appellation'(name: string, user: Pick<User, 'id' | 'name' | 'timers'>): string
    'rank'(name: string): [string, string]
  }
}

declare module 'koishi-core/dist/database' {
  interface User {
    money: number
    wealth: number
    affinity: number
    titles: Affinity[]
    achievement: string[]
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

export function getUserName(ctx: Context, user: Pick<User, 'id' | 'name' | 'timers'>) {
  return ctx.chain('appellation', user.name || '' + user.id, user)
}

((flags: Record<keyof typeof User.Flag, number>) => {
  flags[flags[1 << 6] = 'noLeading'] = 1 << 6
})(User.Flag)

User.extend(() => ({
  titles: [],
  achievement: [],
  affinity: 0,
  wealth: 0,
  money: 0,
}))

export const achvS = 'list_length(`achievement`)'
export const achvH = '(LENGTH(`achievement`) - LENGTH(REPLACE(`achievement`, "-ex" ,""))) / 3'

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', ({ DataType, tables }) => {
  tables.user.titles = new DataType.Json()
  tables.user.achievement = new DataType.Array()
  tables.user.achvS = () => achvS
  tables.user.achvH = () => achvH
})
