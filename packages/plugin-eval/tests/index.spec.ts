/* eslint-disable no-template-curly-in-string */

import { App } from 'koishi-test-utils'
import { resolve } from 'path'
import { promises as fs } from 'fs'
import * as eval from 'koishi-plugin-eval'

const app = new App({ mockStart: false })

app.plugin(eval, {
  root: resolve(__dirname, 'fixtures'),
  setupFiles: {
    'test-worker': resolve(__dirname, 'worker.ts'),
  },
})

const ses = app.session('123')

before(async () => {
  await fs.rmdir(resolve(__dirname, 'fixtures/.koishi'), { recursive: true })
  return new Promise<void>((resolve) => {
    app.on('eval/start', () => resolve())
    app.start()
  })
})

after(() => app.stop())

describe('Eval Plugin', () => {
  it('basic support', async () => {
    await ses.shouldReply('> 1 + 1', '2')
    await ses.shouldNotReply('>> 1 + 2')
    await ses.shouldReply('> send(1 + 3)', '4')
    await ses.shouldReply('>> send(1 + 4)', '5')
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
    await ses.shouldReply('echo 1${2 + 3', '1')
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
    app.worker.config.timeout = 10
    await ses.shouldReply('eval while(1);', '执行超时。')
    app.worker.config.timeout = 1000
  })
})

describe('Eval Addons', () => {
  it('addon command', async () => {
    await ses.shouldReply('addon', /^addon\n扩展功能/)
    await ses.shouldReply('test -h', 'test\n测试功能')
    await ses.shouldReply('test', 'bar')
  })

  it('sandbox injection', async () => {
    await ses.shouldReply('> addon1.foo(1)', 'baz')
  })
})
