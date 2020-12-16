import { Session, extendDatabase } from 'koishi-core'
import MysqlDatabase from 'koishi-plugin-mysql/dist/database'
import MongoDatabase from 'koishi-plugin-mongo/dist/database'

declare module 'koishi-core/dist/database' {
  interface Database {
    createSchedule(time: Date, interval: number, command: string, session: Session): Promise<Schedule>
    removeSchedule(id: number): Promise<any>
    getSchedule(id: number): Promise<Schedule>
    getAllSchedules(assignees?: number[]): Promise<Schedule[]>
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

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', ({ DataType, tables }) => {
  tables.schedule = Object.assign<any, any>([
    'PRIMARY KEY (`id`) USING BTREE',
  ], {
    id: `INT(10) UNSIGNED NOT NULL AUTO_INCREMENT`,
    assignee: `BIGINT(20) NOT NULL DEFAULT '0'`,
    time: `TIMESTAMP NULL DEFAULT NULL`,
    interval: `BIGINT(20) UNSIGNED NOT NULL DEFAULT '0'`,
    command: `MEDIUMTEXT NOT NULL COLLATE 'utf8mb4_general_ci'`,
    session: new DataType.Json(),
  })
})

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', {
  createSchedule(time, interval, command, session) {
    return this.create('schedule', { time, assignee: session.selfId, interval, command, session })
  },

  removeSchedule(id) {
    return this.query('DELETE FROM `schedule` WHERE `id` = ?', [id])
  },

  async getSchedule(id) {
    const data = await this.query('SELECT * FROM `schedule` WHERE `id` = ?', [id])
    return data[0]
  },

  async getAllSchedules(assignees) {
    let queryString = 'SELECT * FROM `schedule`'
    if (!assignees) assignees = await this.app.getSelfIds()
    queryString += ` WHERE \`assignee\` IN (${assignees.join(',')})`
    return this.query(queryString)
  },
})

extendDatabase<typeof MongoDatabase>('koishi-plugin-mongo', {
  async createSchedule(time, interval, command, session) {
    let _id = 1
    const [latest] = await this.db.collection('schedule').find().sort('_id', -1).limit(1).toArray()
    if (latest) _id = latest._id + 1
    const data = { time, interval, command, assignee: session.selfId }
    const result = await this.db.collection('schedule').insertOne({
      _id,
      ...data,
      session: JSON.stringify(session),
    })
    return { ...data, session, id: result.insertedId }
  },

  removeSchedule(_id) {
    return this.db.collection('schedule').deleteOne({ _id })
  },

  async getSchedule(_id) {
    const res = await this.db.collection('schedule').findOne({ _id })
    if (res) {
      res.id = res._id
      res.session = JSON.parse(res.session)
    }
    return res
  },

  async getAllSchedules(assignees) {
    const $in = assignees || await this.app.getSelfIds()
    return await this.db.collection('schedule')
      .find({ assignee: { $in } })
      .map(doc => ({ ...doc, id: doc._id, session: JSON.parse(doc.session) }))
      .toArray()
  },
})
