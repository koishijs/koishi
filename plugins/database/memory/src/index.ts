import { defineDriver, Schema } from 'koishi'
import MemoryDriver from '@minatojs/driver-memory'

export default defineDriver(MemoryDriver, Schema.object({}))
