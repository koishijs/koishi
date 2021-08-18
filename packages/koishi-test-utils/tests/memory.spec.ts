import { App, Tests } from 'koishi-test-utils'

describe('Memory Database', () => {
  const app = new App({ mockDatabase: true })

  Tests.orm(app)
})
