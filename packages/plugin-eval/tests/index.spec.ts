import { App } from 'koishi-test-utils'
import { resolve } from 'path'
import * as pluginEval from 'koishi-plugin-eval'

require('koishi-plugin-eval/src/main').workerScript = [
  'require("ts-node/register/transpile-only");',
  'require("tsconfig-paths/register");',
  `require(${JSON.stringify(resolve(__dirname, '../src/worker.ts'))})`,
].join('\n')

const app = new App()

app.plugin(pluginEval, {
  setupFiles: {
    'test-worker': resolve(__dirname, 'worker.ts'),
  },
})

const ses = app.session(123)

before(() => app.start())

after(() => app.stop())

describe('Eval Plugin', () => {
  it('basic support', async () => {
    await ses.shouldReply('> 1+1', '2')
    await ses.shouldNotReply('>> 1+1')
    await ses.shouldReply('> send(1+1)', '2')
    await ses.shouldReply('>> send(1+1)', '2')
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

  it('global', async () => {
    await ses.shouldNotReply('> global.console')
    await ses.shouldNotReply('> global.setTimeout')
    await ses.shouldNotReply('> global.setInterval')
    await ses.shouldReply('> exec', '[AsyncFunction: exec]')
    await ses.shouldReply('> exec.toString()', 'function exec() { [native code] }')
  })

  it('attack 1', async () => {
    await ses.shouldReply(`>
      const func1 = this.constructor.constructor("return Function('return Function')")()();
      const func2 = this.constructor.constructor("return Function")();
      func1 === func2;
    `, 'true')

    await ses.shouldReply(`>
      const ForeignFunction = global.constructor.constructor;
      const process1 = ForeignFunction("return process")();
    `, /^ReferenceError: process is not defined/)
  })
})
