import { Meta, extendDatabase } from 'koishi-core'
import type MysqlDatabase from 'koishi-plugin-mysql'

declare module 'koishi-core/dist/database' {
  interface Database {
    createSchedule (time: Date, interval: number, command: string, meta: Meta): Promise<Schedule>
    removeSchedule (id: number): Promise<any>
    getSchedule (id: number): Promise<Schedule>
    getAllSchedules (assignees?: number[]): Promise<Schedule[]>
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
  meta: Meta
}

extendDatabase<MysqlDatabase>('koishi-plugin-mysql', {
  createSchedule (time, interval, command, meta) {
    return this.create('schedule', { time, assignee: meta.selfId, interval, command, meta })
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
    if (!assignees) assignees = await this.app.getSelfIds()
    queryString += ` WHERE \`assignee\` IN (${assignees.join(',')})`
    return this.query(queryString)
  },
})
