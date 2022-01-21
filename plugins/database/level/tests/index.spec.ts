import { App } from 'koishi'
import { resolve } from 'path'
import tests from '@koishijs/database-tests'
import level from '@koishijs/plugin-database-level'
import mock from '@koishijs/plugin-mock'

describe('LevelDB Database', () => {
  const app = new App()

  app.plugin(mock)

  app.plugin(level, {
    location: resolve(__dirname, 'temp'),
  })

  tests.database(app)
})
