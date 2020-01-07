import { testDatabase, registerMemoryDatabase } from 'koishi-test-utils'

registerMemoryDatabase()

testDatabase({
  memory: {},
}, {
  beforeEachUser: app => app.database.memory.store.user = [],
  beforeEachGroup: app => app.database.memory.store.group = [],
})
