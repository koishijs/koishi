import { Channel } from 'koishi-core'
import Statistics from './stats'

import './mongo'
import './mysql'

export interface ActiveData {
  activeUsers: number
  activeGroups: number
}

export type Activity = Record<number, number>
export type StatRecord = Record<string, number>

export interface Synchronizer {
  groups: StatRecord
  daily: Record<Synchronizer.DailyField, StatRecord>
  hourly: Record<Synchronizer.HourlyField, number>
  longterm: Record<Synchronizer.LongtermField, number>
  addDaily(field: Synchronizer.DailyField, key: string | number): void
  upload(date: Date): Promise<void>
  download(date: string): Promise<Synchronizer.Data>
}

export namespace Synchronizer {
  export type DailyField = typeof dailyFields[number]
  export const dailyFields = [
    'command', 'dialogue', 'botSend', 'botReceive', 'group',
  ] as const

  export type HourlyField = typeof hourlyFields[number]
  export const hourlyFields = [
    'total', 'group', 'private', 'command', 'dialogue',
  ] as const

  export type LongtermField = typeof longtermFields[number]
  export const longtermFields = [
    'message',
  ] as const

  export interface Data {
    extension?: Statistics
    groups: Pick<Channel, 'id' | 'name' | 'assignee'>[]
    daily: Record<DailyField, StatRecord>[]
    hourly: ({ time: Date } & Record<HourlyField, number>)[]
    longterm: ({ time: Date } & Record<LongtermField, number>)[]
  }
}

declare module 'koishi-core' {
  interface User {
    lastCall: Date
  }

  interface App {
    synchronizer: Synchronizer
  }

  interface Database {
    getActiveData(): Promise<ActiveData>
    getStatsData(): Promise<Synchronizer.Data>
    setChannels(data: Partial<Channel>[]): Promise<void>
    Synchronizer: new (db: Database) => Synchronizer
  }

  interface Channel {
    name: string
    activity: Activity
  }

  interface Session {
    _sendType?: 'command' | 'dialogue'
  }
}

Channel.extend(() => ({
  activity: {},
}))
