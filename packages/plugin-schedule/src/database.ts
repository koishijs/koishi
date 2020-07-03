import { Meta, getSelfIds, injectMethods } from 'koishi-core'
import {} from 'koishi-database-mysql'
import { Schedule } from '.'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    schedule?: ScheduleMethods
  }

  interface TableData {
    schedule?: Schedule
  }
}

interface ScheduleMethods {
  createSchedule (time: Date, assignee: number, interval: number, command: string, meta: Meta): Promise<Schedule>
  removeSchedule (id: number): Promise<any>
  getSchedule (id: number): Promise<Schedule>
  getAllSchedules (assignees?: number[]): Promise<Schedule[]>
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
