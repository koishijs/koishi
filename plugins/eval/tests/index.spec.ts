import { App } from 'koishi'
import { resolve } from 'path'
import { promises as fs } from 'fs'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import * as eval from '@koishijs/plugin-eval'
import * as teach from '@koishijs/plugin-teach'

const app = new App()

app.plugin(memory)
app.plugin(mock)

app.plugin(eval, {
  root: resolve(__dirname, 'fixtures'),
  setupFiles: {
    'test-worker': resolve(__dirname, 'worker.ts'),
  },
})

app.plugin(teach, {
  historyTimeout: 0,
  useContext: false,
  useTime: false,
  useWriter: false,
  successorTimeout: 0,
})

const client = app.mock.client('123', '456')

before(async () => {
  await app.mock.initUser('123', 3)
  await app.mock.initChannel('456')
  await fs.rmdir(resolve(__dirname, 'fixtures/.koishi'), { recursive: true })
  return new Promise<void>((resolve) => {
    app.on('eval/start', () => resolve())
    app.start()
  })
})

after(() => app.stop())

describe('Eval Plugin', () => {
  it('basic support', async () => {
    await client.shouldReply('> 1 + 1', '2')
    await client.shouldNotReply('>> 1 + 2')
    await client.shouldReply('> send(1 + 3)', '4')
    await client.shouldReply('>> send(1 + 4)', '5')
  })

  it('validation', async () => {
    await client.shouldReply('>', '请输入要执行的脚本。')
  })

  it('error', async () => {
    await client.shouldReply('> throw 1', 'Uncaught: 1')
    await client.shouldReply('> foo', 'ReferenceError: foo is not defined\n    at stdin:1:1')
    await client.shouldReply('> 1f', /^SyntaxError/)
  })

  it('exec', async () => {
    await client.shouldReply('> exec()', /^TypeError: The "message" argument must be of type string/)
    await client.shouldReply('> exec("help")', /^当前可用的指令有：/)
  })

  it('noEval', async () => {
    app.command('foo', { noEval: true })
    await client.shouldReply('> exec("foo")', /^不能在 evaluate 指令中调用 foo 指令。/)
  })

  it('command interpolate', async () => {
    app.command('echo <text:text>').action((_, text) => text)
    await client.shouldReply('echo 1${1 + 1}3', '123')
    await client.shouldReply('echo 1${2 + 3', '1')
  })

  it('dialogue interpolate', async () => {
    await client.shouldReply('# demo 1${1 + 1}3', '问答已添加，编号为 1。')
    await client.shouldReply('demo', '123')
    await client.shouldReply('# ^repeat:(.+) ${"$1".repeat(3)} -x', '问答已添加，编号为 2。')
    await client.shouldReply('repeat:123', '123123123')
    await client.shouldReply('# ^我.+ 对，${"$0".replace(/我/, "你")} -x', '问答已添加，编号为 3。')
    await client.shouldReply('我是伞兵', '对，你是伞兵')
  })

  it('global', async () => {
    await client.shouldNotReply('> global.console')
    await client.shouldNotReply('> global.setTimeout')
    await client.shouldNotReply('> global.setInterval')
    await client.shouldReply('> exec', '[AsyncFunction: exec]')
    await client.shouldReply('> exec.toString()', 'function exec() { [native code] }')
  })

  it('restart', async () => {
    await client.shouldNotReply('>> foo = 1')
    await client.shouldReply('> foo', '1')
    await client.shouldReply('eval -r', '子线程已重启。')
    await client.shouldReply('> foo', 'ReferenceError: foo is not defined\n    at stdin:1:1')
  })

  it('timeout', async () => {
    app.worker.config.timeout = 10
    await client.shouldReply('eval while(1);', '执行超时。')
    app.worker.config.timeout = 1000
  })
})

describe('Eval Loaders', () => {
  function createApp(scriptLoader: string) {
    const app = new App().plugin(mock)
    app.command('echo <text:text>').action((_, text) => text)
    app.plugin(eval, { scriptLoader })

    return new Promise<App>((resolve) => {
      app.on('eval/start', () => resolve(app))
      app.start()
    })
  }

  it('esbuild', async () => {
    const app = await createApp('esbuild')
    const client = app.mock.client('123')
    await client.shouldReply('echo 1${"foo" as string}3', '1foo3')
    await app.stop()
  })

  it('coffeescript', async () => {
    const app = await createApp('coffeescript')
    const client = app.mock.client('123')
    await client.shouldReply('echo 1${"foobar"}3', '1foobar3')
    await client.shouldReply('evaluate await 1; 2', '2')
    await app.stop()
  })
})

describe('Eval Addons', () => {
  it('addon command', async () => {
    await client.shouldReply('addon', /^addon\n扩展功能/)
    await client.shouldReply('test -h', 'test\n测试功能')
    await client.shouldReply('test', 'barbaz')
  })

  it('sandbox injection', async () => {
    await client.shouldReply('> addon1.foo(1)', 'baz')
  })
})
