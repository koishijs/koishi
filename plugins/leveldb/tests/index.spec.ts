import { App, Tests } from '@koishijs/test-utils'
import * as leveldb from '@koishijs/plugin-leveldb'
import { resolve } from 'path'

describe('LevelDB Database', () => {
  const app = new App()

  app.plugin(leveldb, {
    path: resolve(__dirname, 'temp'),
  })

  Tests.database(app)
})
