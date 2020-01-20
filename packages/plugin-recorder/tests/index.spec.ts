import { MockedApp, BASE_SELF_ID } from 'koishi-test-utils'
import { startAll, stopAll } from 'koishi-core'
import { readFileSync } from 'fs-extra'
import { resolve } from 'path'
import { sleep } from 'koishi-utils'
import * as recorder from '../src'
import del from 'del'

const app1 = new MockedApp()
const app2 = new MockedApp({ selfId: BASE_SELF_ID + 1 })

app1.plugin(recorder)
app2.plugin(recorder)

beforeAll(() => startAll())

const outFolder = resolve(process.cwd(), 'messages')

afterAll(() => del(outFolder))

test('group message', async () => {
  const mock = jest.fn()
  app1.receiver.on('record-writing', mock)
  await app1.receiveMessage('group', 'foo', 123, 321)
  await app1.receiveMessage('group', 'bar', 456, 654)
  await app1.receiveMessage('group', 'baz', 789, 321)
  expect(mock).toBeCalledTimes(3)
})

test('private message', async () => {
  const mock = jest.fn()
  app1.receiver.on('record-writing', mock)
  await app1.receiveMessage('user', 'foo', 123)
  expect(mock).toBeCalledTimes(0)
})

test('check content', async () => {
  await stopAll()
  await sleep(100)
  expect(readFileSync(resolve(outFolder, '321.txt'), 'utf8')).toMatchSnapshot()
})
