import { MessageMeta, getSelfIds, injectMethods } from 'koishi-core'
import {} from 'koishi-database-mysql'
import {} from 'koishi-database-level'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    schedule?: ScheduleMethods
  }

  interface TableData {
    schedule?: Schedule
  }
}

interface ScheduleMethods {
  createSchedule (time: Date, assignee: number, interval: number, command: string, meta: MessageMeta): Promise<Schedule>
  removeSchedule (id: number): Promise<any>
  getSchedule (id: number): Promise<Schedule>
  getAllSchedules (assignees?: number[]): Promise<Schedule[]>
}

export interface Schedule {
  id: number
  assignee: number
  time: Date
  interval: number
  command: string
  meta: MessageMeta
}

injectMethods('mysql', 'schedule', {
  createSchedule (time, assignee, interval, command, meta) {
    return this.create('schedule', { time, assignee, interval, command, meta })
  },

  removeSchedule (id) {
    return this.query('DELETE FROM `schedule` WHERE `id` = ?', [id])
  },

  async getSchedule (id) {
    const data = await this.query('SELECT * FROM `schedule` WHERE `id` = ?', [id])
    return data[0]
  },

  async getAllSchedules (assignees) {
    let queryString = 'SELECT * FROM `schedule`'
    if (!assignees) assignees = await getSelfIds()
    queryString += ` WHERE \`assignee\` IN (${assignees.join(',')})`
    return this.query(queryString)
  },
})

injectMethods('level', 'schedule', {
  createSchedule (time, assignee, interval, command, meta) {
    return this.create('schedule', { time, assignee, interval, command, meta })
  },

  removeSchedule (id) {
    return this.remove('schedule', id)
  },

  getSchedule (id) {
    return this.tables.schedule.get(id)
  },

  async getAllSchedules (assignees) {
    if (!assignees) assignees = await getSelfIds()
    return new Promise((resolve) => {
      const data: Schedule[] = []
      this.tables.schedule.createValueStream()
        .on('data', item => assignees.includes(item.assignee) ? data.push(item) : null)
        .on('end', () => resolve(data))
    })
  },
})
