/* eslint-disable no-template-curly-in-string */
import { App } from 'koishi-test-utils'
import { resolve } from 'path'
import * as pluginEval from 'koishi-plugin-eval'

const app = new App()

app.plugin(pluginEval, {
  timeout: 1000,
  setupFiles: {
    'test-worker': resolve(__dirname, 'worker.ts'),
  },
})

const ses = app.session('123')

before(() => app.start())

after(() => app.stop())

describe('Eval Plugin', () => {
  it('basic support', async () => {
    await ses.shouldReply('> 1 + 1', '2')
    await ses.shouldNotReply('>> 1 + 1')
    await ses.shouldReply('> send(1 + 1)', '2')
    await ses.shouldReply('>> send(1 + 1)', '2')
  })

  it('validation', async () => {
    await ses.shouldReply('>', '请输入要执行的脚本。')
  })

  it('error', async () => {
    await ses.shouldReply('> throw 1', 'Uncaught: 1')
    await ses.shouldReply('> foo', 'ReferenceError: foo is not defined\n    at stdin:1:1')
    await ses.shouldReply('> 1f', 'SyntaxError: Invalid or unexpected token\n    at stdin:1:1')
  })

  it('exec', async () => {
    await ses.shouldReply('> exec()', /^TypeError: The "message" argument must be of type string/)
    await ses.shouldReply('> exec("help")', /^当前可用的指令有：/)
  })

  it('noEval', async () => {
    app.command('foo', { noEval: true })
    await ses.shouldReply('> exec("foo")', /^不能在 evaluate 指令中调用 foo 指令。/)
  })

  it('interpolate', async () => {
    app.command('echo <text:text>').action((_, text) => text)
    await ses.shouldReply('echo 1${1 + 1}3', '123')
    await ses.shouldReply('echo 1${2 + 3', '12 + 3')
  })

  it('global', async () => {
    await ses.shouldNotReply('> global.console')
    await ses.shouldNotReply('> global.setTimeout')
    await ses.shouldNotReply('> global.setInterval')
    await ses.shouldReply('> exec', '[AsyncFunction: exec]')
    await ses.shouldReply('> exec.toString()', 'function exec() { [native code] }')
  })

  it('restart', async () => {
    await ses.shouldNotReply('>> foo = 1')
    await ses.shouldReply('> foo', '1')
    await ses.shouldReply('eval -r', '子线程已重启。')
    await ses.shouldReply('> foo', 'ReferenceError: foo is not defined\n    at stdin:1:1')
  })

  it('timeout', async () => {
    await ses.shouldReply('eval while(1);', '执行超时。')
  })
})
