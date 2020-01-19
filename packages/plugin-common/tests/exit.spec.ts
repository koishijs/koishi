import { MockedApp } from 'koishi-test-utils'
import { exit } from '../src'

const app = new MockedApp({ nickname: 'koishi' })
const session = app.createSession('user', 123)

app.plugin(exit)

const processExit = process.exit
const mock = process.exit = jest.fn<never, [number?]>()

beforeEach(() => mock.mockClear())
afterAll(() => process.exit = processExit)

test('terminate', async () => {
  await session.shouldHaveNoResponse(`koishi, 关机`)
  expect(mock).toBeCalledTimes(1)
  expect(mock).toBeCalledWith(0)
})

test('restart', async () => {
  await session.shouldHaveNoResponse(`koishi, 重启`)
  expect(mock).toBeCalledTimes(1)
  expect(mock).toBeCalledWith(-1)
})
