import { testDatabase, MemoryDatabase } from 'koishi-test-utils'
import { registerDatabase } from 'koishi-core'

registerDatabase('memory', MemoryDatabase)

testDatabase({
  memory: {},
}, {
  beforeEachUser: app => app.database.memory.store.user = [],
  beforeEachGroup: app => app.database.memory.store.group = [],
})
