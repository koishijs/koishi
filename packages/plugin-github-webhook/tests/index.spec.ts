import { MockedApp } from 'koishi-test-utils'
import { apply, webhooks } from '../src'
import { readdirSync } from 'fs-extra'
import { resolve } from 'path'

const app = new MockedApp({
  githubWebhook: {
    secret: 'secret',
  },
})

app.plugin(apply, {
  'koishijs/koishi': [123],
})

const webhook = webhooks['/secret12140']

readdirSync(resolve(__dirname, '__fixtures__')).forEach((file) => {
  file = file.slice(0, -5)
  const [name] = file.split('.', 1)
  const payload = require(`./__fixtures__/${file}`)

  test(file, async () => {
    await webhook.receive({ id: 'id', name, payload })
    app.shouldMatchSnapshot(file)
  })
})
