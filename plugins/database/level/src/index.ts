import { defineDriver, Schema } from 'koishi'
import LevelDriver from '@minatojs/driver-level'

export default defineDriver(LevelDriver, Schema.object({
  location: Schema.string().description('数据保存的位置').default('.level'),
}))
