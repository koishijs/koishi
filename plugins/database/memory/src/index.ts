import { DatabaseService, Schema } from 'koishi'
import MemoryDriver from '@cosmotype/driver-memory'

export type Config = MemoryDriver.Config

export const Config: Schema<Config> = Schema.object({})

export default DatabaseService.plugin(MemoryDriver, Config)
