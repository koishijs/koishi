/* eslint-disable no-template-curly-in-string */

import { App } from 'koishi-test-utils'
import { resolve } from 'path'
import { promises as fs } from 'fs'
import * as eval from 'koishi-plugin-eval'
import * as teach from 'koishi-plugin-teach'

const app = new App({
  mockStart: false,
  mockDatabase: true,
})

app.plugin(eval, {
  root: resolve(__dirname, 'fixtures'),
  setupFiles: {
    'test-worker': resolve(__dirname, 'worker.ts'),
  },
})

app.plugin(teach, {
  historyAge: 0,
  useContext: false,
  useTime: false,
  useWriter: false,
  successorTimeout: 0,
})

const ses = app.session('123', '456')

before(async () => {
  await app.database.initUser('123', 3)
  await app.database.initChannel('456')
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
    await ses.shouldReply('> 1f', /^SyntaxError/)
  })

  it('exec', async () => {
    await ses.shouldReply('> exec()', /^TypeError: The "message" argument must be of type string/)
    await ses.shouldReply('> exec("help")', /^当前可用的指令有：/)
  })

  it('noEval', async () => {
    app.command('foo', { noEval: true })
    await ses.shouldReply('> exec("foo")', /^不能在 evaluate 指令中调用 foo 指令。/)
  })

  it('command interpolate', async () => {
    app.command('echo <text:text>').action((_, text) => text)
    await ses.shouldReply('echo 1${1 + 1}3', '123')
    await ses.shouldReply('echo 1${2 + 3', '1')
  })

  it('dialogue interpolate', async () => {
    await ses.shouldReply('# demo 1${1 + 1}3', '问答已添加，编号为 1。')
    await ses.shouldReply('demo', '123')
    await ses.shouldReply('# ^repeat:(.+) ${"$1".repeat(3)} -x', '问答已添加，编号为 2。')
    await ses.shouldReply('repeat:123', '123123123')
    await ses.shouldReply('# ^我.+ 对，${"$0".replace(/我/, "你")} -x', '问答已添加，编号为 3。')
    await ses.shouldReply('我是伞兵', '对，你是伞兵')
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

describe('Eval Loaders', () => {
  function createApp(scriptLoader: string) {
    const app = new App({ mockStart: false })
    app.command('echo <text:text>').action((_, text) => text)
    app.plugin(eval, { scriptLoader })

    return new Promise<App>((resolve) => {
      app.on('eval/start', () => resolve(app))
      app.start()
    })
  }

  it('esbuild', async () => {
    const app = await createApp('esbuild')
    const ses = app.session('123')
    await ses.shouldReply('echo 1${"foo" as string}3', '1foo3')
    await app.stop()
  })

  it('coffeescript', async () => {
    const app = await createApp('coffeescript')
    const ses = app.session('123')
    await ses.shouldReply('echo 1${"foobar"}3', '1foobar3')
    await ses.shouldReply('evaluate await 1; 2', '2')
    await app.stop()
  })
})

describe('Eval Addons', () => {
  it('addon command', async () => {
    await ses.shouldReply('addon', /^addon\n扩展功能/)
    await ses.shouldReply('test -h', 'test\n测试功能')
    await ses.shouldReply('test', 'barbaz')
  })

  it('sandbox injection', async () => {
    await ses.shouldReply('> addon1.foo(1)', 'baz')
  })
})
