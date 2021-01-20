import { testDatabase, App } from 'koishi-test-utils'

describe('Memory Database', () => {
  testDatabase(new App({ mockDatabase: true }))
})
