import { Session, Database, Tables } from 'koishi-core'
import {} from 'koishi-plugin-mysql'
import {} from 'koishi-plugin-mongo'

declare module 'koishi-core' {
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
  session: Partial<Session>
}

Tables.extend('schedule')

Database.extend('koishi-plugin-mysql', ({ Domain, tables }) => {
  tables.schedule = {
    id: `INT(10) UNSIGNED NOT NULL AUTO_INCREMENT`,
    assignee: `VARCHAR(50) NOT NULL`,
    time: `TIMESTAMP NULL DEFAULT NULL`,
    lastCall: `TIMESTAMP NULL DEFAULT NULL`,
    interval: `BIGINT(20) UNSIGNED NOT NULL DEFAULT '0'`,
    command: `MEDIUMTEXT NULL`,
    session: new Domain.Json(),
  }
})
