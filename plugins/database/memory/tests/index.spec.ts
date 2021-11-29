import { App } from 'koishi'
import { resolve } from 'path'
import tests from '@koishijs/test-utils'
import mock from '@koishijs/plugin-mock'
import database from '@koishijs/plugin-database-memory'

describe('Memory Database', () => {
  const app = new App()

  app.plugin(mock)

  app.plugin(database, {
    storage: true,
    root: resolve(__dirname, 'temp'),
  })

  tests.database(app)
})
