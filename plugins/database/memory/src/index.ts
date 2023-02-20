import { defineDriver, Schema } from 'koishi'
import MemoryDriver from '@minatojs/driver-memory'

export = defineDriver(MemoryDriver, Schema.object({}))
