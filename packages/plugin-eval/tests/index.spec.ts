import { App } from 'koishi-test-utils'
import { inspect } from 'util'
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

  it('validation', async () => {
    await ses.shouldHaveReply('>', '请输入要执行的脚本。')
  })

  it('error', async () => {
    await ses.shouldHaveReply('> throw 1', 'Uncaught: 1')
    await ses.shouldHaveReply('> foo', 'ReferenceError: foo is not defined\n    at stdin:1:1')
    await ses.shouldHaveReply('> 1f', 'SyntaxError: Invalid or unexpected token\n    at stdin:1:1')
  })

  it('exec', async () => {
    await ses.shouldHaveReply('> exec()').which.matches(/TypeError: The "message" argument must be of type string/)
    await ses.shouldHaveReply('> exec("help")').which.matches(/当前可用的指令有：/)
  })

  it('global', async () => {
    await ses.shouldHaveNoReply('> global.console')
    await ses.shouldHaveNoReply('> global.setTimeout')
    await ses.shouldHaveNoReply('> global.setInterval')
    await ses.shouldHaveReply('> exec', '[AsyncFunction: exec]')
    await ses.shouldHaveReply('> exec.toString()', 'function exec() { [native code] }')
    await ses.shouldHaveReply('> Buffer.alloc', '[Function: alloc]')
    await ses.shouldHaveReply('> Buffer.alloc.toString()', 'function alloc() { [native code] }')
  })

  it('host inspect', async () => {
    await ses.shouldHaveReply('> [1, 2]', inspect([1, 2]))
    await ses.shouldHaveReply('> new Set([1, 2])', inspect(new Set([1, 2])))
    await ses.shouldHaveReply('> new Map([[1, 2]])', inspect(new Map([[1, 2]])))
    await ses.shouldHaveReply('> new RegExp()', inspect(new RegExp(undefined)))
    await ses.shouldHaveReply('> Proxy', inspect(Proxy))
  })

  it('attack 1', async () => {
    await ses.shouldHaveReply(`>
      const func1 = this.constructor.constructor("return Function('return Function')")()();
      const func2 = this.constructor.constructor("return Function")();
      func1 === func2;
    `, 'true')

    await ses.shouldHaveReply(`>
      const ForeignFunction = global.constructor.constructor;
      const process1 = ForeignFunction("return process")();
    `).which.matches(/ReferenceError: process is not defined/)
  })

  it('buffer attack', async () => {
    await ses.shouldHaveReply(`>
      Buffer.allocUnsafe(100).constructor.constructor === Function &&
      Buffer.allocUnsafeSlow(100).constructor.constructor === Function;
    `, 'true')

    await ses.shouldHaveReply(`>
      Buffer.allocUnsafe(100).toString('hex') +
      Buffer.allocUnsafeSlow(100).toString('hex');
    `, '00'.repeat(200))
  })
})
