import { App, Tests } from '@koishijs/test-utils'
import * as level from '@koishijs/plugin-database-level'
import { resolve } from 'path'

describe('LevelDB Database', () => {
  const app = new App()

  app.plugin(level, {
    location: resolve(__dirname, 'temp'),
  })

  Tests.database(app)
})
