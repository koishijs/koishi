import { App, Tests } from '@koishijs/test-utils'

describe('Memory Database', () => {
  const app = new App({ mockDatabase: true })

  Tests.database(app)
})
