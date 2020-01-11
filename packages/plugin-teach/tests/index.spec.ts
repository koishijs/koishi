import { MockedApp } from 'koishi-test-utils'
import { resolve } from 'path'
import * as teach from '../src'
import { help } from 'koishi-plugin-common'
import 'koishi-database-level'
import del from 'del'

const path = resolve(__dirname, '../temp')

const app = new MockedApp({ database: { level: { path } } })
const session = app.createSession('group', 123, 456)

app.plugin(teach)
app.plugin(help)

beforeAll(async () => {
  await app.start()
})

afterAll(async () => {
  await app.stop()
  await del(path)
})

test('basic support', async () => {
  await session.shouldHaveNoResponse('foo')

  // await session.shouldHaveReply('teach foo bar', '编号为 0。')
})
