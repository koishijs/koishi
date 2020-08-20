import { App } from 'koishi-test-utils'
import * as _eval from '../dist'

const app = new App()
app.plugin(_eval)

const ses = app.createSession('user', 123)

before(() => app.start())

after(() => app.stop())

describe('koishi-plugin-eval', () => {
  it('basic support', async () => {
    await ses.shouldHaveReply('> 1+1', '2')
    await ses.shouldHaveNoReply('>> 1+1')
    await ses.shouldHaveReply('> send(1+1)', '2')
    await ses.shouldHaveReply('>> send(1+1)', '2')
  })

  it('error', async () => {
    await ses.shouldHaveReply('> throw 1', 'Uncaught: 1')
    await ses.shouldHaveReply('> foo', 'ReferenceError: foo is not defined\n    at stdin:1:1')
    await ses.shouldHaveReply('> 1f', 'SyntaxError: Invalid or unexpected token\n    at stdin:1:1')
  })

  it('exec', async () => {
    // FIXME mocha do not have sourcemap
    // TypeError: The "message" argument must be of type string
    await ses.shouldHaveReply('> exec()')
    await ses.shouldHaveReply('> exec("help")')
  })

  it('host inspect', async () => {
    await ses.shouldHaveReply('> [1, 2]', '[ 1, 2 ]')
    await ses.shouldHaveReply('> new Set([1, 2])', 'Set(2) { 1, 2 }')
    await ses.shouldHaveReply('> new Map([[1, 2]])', 'Map(1) { 1 => 2 }')
    await ses.shouldHaveReply('> new RegExp()', '/(?:)/')
  })
})
