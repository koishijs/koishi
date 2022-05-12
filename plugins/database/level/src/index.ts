import { DatabaseService, Schema } from 'koishi'
import LevelDriver from '@cosmotype/driver-level'

export type Config = LevelDriver.Config

export const Config: Schema<Config> = Schema.object({
  location: Schema.string().description('数据保存的位置').default('.level'),
})

export default DatabaseService.plugin(LevelDriver, Config)
