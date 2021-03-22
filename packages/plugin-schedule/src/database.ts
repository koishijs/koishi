import { Session, Database } from 'koishi-core'
import {} from 'koishi-plugin-mysql'
import {} from 'koishi-plugin-mongo'

declare module 'koishi-core' {
  interface Database {
    updateSchedule(id: number, data: Partial<Schedule>): Promise<void>
    getAllSchedules(assignee?: string): Promise<Schedule[]>
  }

  interface Tables {
    schedule: Schedule
  }
}

export interface Schedule {
  id: number
  assignee: string
  time: Date
  lastCall: Date
  interval: number
  command: string
  session: Session
}

Database.extend('koishi-plugin-mysql', ({ Domain, tables }) => {
  tables.schedule = Object.assign<any, any>([
    'PRIMARY KEY (`id`) USING BTREE',
  ], {
    id: `INT(10) UNSIGNED NOT NULL AUTO_INCREMENT`,
    assignee: `VARCHAR(50) NOT NULL`,
    time: `TIMESTAMP NULL DEFAULT NULL`,
    lastCall: `TIMESTAMP NULL DEFAULT NULL`,
    interval: `BIGINT(20) UNSIGNED NOT NULL DEFAULT '0'`,
    command: `MEDIUMTEXT NOT NULL COLLATE 'utf8mb4_general_ci'`,
    session: new Domain.Json(),
  })
})

Database.extend('koishi-plugin-mysql', {
  async getAllSchedules(assignee) {
    const assignees = assignee
      ? [this.escape(assignee)]
      : this.app.bots.map(bot => this.escape(bot.sid))
    if (!assignees.length) return []
    return this.query(`SELECT * FROM \`schedule\` WHERE \`assignee\` IN (${assignees.join(',')})`)
  },
})

Database.extend('koishi-plugin-mongo', ({ tables }) => {
  tables.schedule = { primary: 'id', incremental: true }
})

Database.extend('koishi-plugin-mongo', {
  async getAllSchedules(assignee) {
    const $in = assignee
      ? [assignee]
      : this.app.bots.map(bot => bot.sid)
    return await this.db.collection('schedule')
      .find({ assignee: { $in } })
      .map(doc => ({ ...doc, id: doc._id, session: JSON.parse(doc.session) }))
      .toArray()
  },
})
