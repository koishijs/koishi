import { Session, extendDatabase } from 'koishi-core'
import MysqlDatabase from 'koishi-plugin-mysql/dist/database'
import MongoDatabase from 'koishi-plugin-mongo/dist/database'

declare module 'koishi-core/dist/database' {
  interface User {
    lastCall: Date
  }
}

export interface ActiveData {
  activeUsers: number
  activeGroups: number
}

declare module 'koishi-core/dist/database' {
  interface Database {
    getActiveData (): Promise<ActiveData>
  }

  interface Tables {
    schedule: Schedule
  }
}

export interface Schedule {
  id: number
  assignee: number
  time: Date
  interval: number
  command: string
  session: Session
}

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', {
  async getActiveData() {
    const [[{ 'COUNT(*)': activeUsers }], [{ 'COUNT(*)': activeGroups }]] = await this.query<[{ 'COUNT(*)': number }][]>([
      'SELECT COUNT(*) FROM `user` WHERE CURRENT_TIMESTAMP() - `lastCall` < 1000 * 3600 * 24',
      'SELECT COUNT(*) FROM `channel` WHERE `assignee`',
    ])
    return { activeGroups, activeUsers }
  },
})

extendDatabase<typeof MongoDatabase>('koishi-plugin-mongo', {
  async getActiveData() {
    const $gt = new Date(new Date().getTime() - 1000 * 3600 * 24)
    const [activeGroups, activeUsers] = await Promise.all([
      this.channel.find({ assignee: { $ne: null } }).count(),
      this.user.find({ lastCall: { $gt } }).count(),
    ])
    return { activeGroups, activeUsers }
  },
})
