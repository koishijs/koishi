import { App } from 'koishi-test-utils'
import { inspect } from 'util'
import { resolve } from 'path'
import * as _eval from 'koishi-plugin-eval'

const app = new App()
app.plugin(_eval, {
  setupFiles: {
    'test-worker': resolve(__dirname, 'worker.js'),
  },
})

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
    await ses.shouldHaveReply('> exec()').which.matches(/^TypeError: The "message" argument must be of type string/)
    await ses.shouldHaveReply('> exec("help")').which.matches(/^当前可用的指令有：/)
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

  it('contextify', async () => {
    await ses.shouldHaveReply('> test.null === null', 'true')
    await ses.shouldHaveReply('> test.undefined === undefined', 'true')
    await ses.shouldHaveReply('> test.string.constructor === String', 'true')
    await ses.shouldHaveReply('> test.number.constructor === Number', 'true')
    await ses.shouldHaveReply('> test.boolean.constructor === Boolean', 'true')
    await ses.shouldHaveReply('> test.stringO instanceof String', 'true')
    await ses.shouldHaveReply('> test.numberO instanceof Number', 'true')
    await ses.shouldHaveReply('> test.booleanO instanceof Boolean', 'true')
    await ses.shouldHaveReply('> test.date instanceof Date', 'true')
    await ses.shouldHaveReply('> test.regexp instanceof RegExp', 'true')
    await ses.shouldHaveReply('> test.buffer instanceof Buffer', 'true')
    await ses.shouldHaveReply('> test.error instanceof Error', 'true')
    await ses.shouldHaveReply('> test.rangeError instanceof RangeError', 'true')
    await ses.shouldHaveReply('> test.syntaxError instanceof SyntaxError', 'true')
    await ses.shouldHaveReply('> test.referenceError instanceof ReferenceError', 'true')
    await ses.shouldHaveReply('> test.typeError instanceof TypeError', 'true')
    await ses.shouldHaveReply('> test.evalError instanceof EvalError', 'true')
    await ses.shouldHaveReply('> test.uriError instanceof URIError', 'true')
  })

  it('function', async () => {
    await ses.shouldHaveReply('> test.function instanceof Function', 'true')
    await ses.shouldHaveReply('> test.function() instanceof Function', 'true')
    await ses.shouldHaveReply('> test.function()() instanceof Object', 'true')
  })

  it('symbol', async () => {
    await ses.shouldHaveReply('> Symbol.for("test") === test.symbol2', 'true')
    await ses.shouldHaveReply('> test.symbol1.constructor.constructor === Function', 'true')
    await ses.shouldHaveReply('> test.symbol2.constructor.constructor === Function', 'true')
    await ses.shouldHaveReply('> test.symbol3.constructor.constructor === Function', 'true')
    await ses.shouldHaveReply('> Symbol("test").constructor.constructor === Function', 'true')
    await ses.shouldHaveReply('> Symbol("foobar").constructor.constructor === Function', 'true')
    await ses.shouldHaveReply('> Symbol.keyFor(test.symbol2)', 'test')
  })

  it('host inspect', async () => {
    await ses.shouldHaveReply('> [1, 2]', inspect([1, 2]))
    await ses.shouldHaveReply('> new Set([1, 2])', inspect(new Set([1, 2])))
    await ses.shouldHaveReply('> new Map([[1, 2]])', inspect(new Map([[1, 2]])))
    await ses.shouldHaveReply('> new WeakSet([[1]])', inspect(new WeakSet([[1]])))
    await ses.shouldHaveReply('> new WeakMap([[[1], 2]])', inspect(new WeakMap([[[1], 2]])))
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
    `).which.matches(/^ReferenceError: process is not defined/)
  })

  it('deprecated api attack', async () => {
    await ses.shouldHaveReply(`> Buffer.prototype.__defineGetter__ === {}.__defineGetter__`, 'true')
    await ses.shouldHaveReply(`> Buffer.prototype.__defineSetter__ === {}.__defineSetter__`, 'true')
    await ses.shouldHaveReply(`> Buffer.prototype.__lookupGetter__ === {}.__lookupGetter__`, 'true')
    await ses.shouldHaveReply(`> Buffer.prototype.__lookupSetter__ === {}.__lookupSetter__`, 'true')

    await ses
      .shouldHaveReply(`> Buffer.prototype.__defineGetter__("toString", () => {})`)
      .which.matches(/'defineProperty' on proxy: trap returned falsish for property 'toString'/)

    await ses.shouldHaveReply(`>
      global.__defineGetter__("foo", () => 123);
      global.foo;
    `, '123')

    await ses.shouldHaveReply(`> Buffer.from.__lookupGetter__("__proto__") === Object.prototype.__lookupGetter__.call(Buffer.from, "__proto__")`, 'true')
  })

  it('buffer operations', async () => {
    await ses.shouldHaveReply(`>
      Buffer.allocUnsafe(100).constructor.constructor === Function &&
      Buffer.allocUnsafeSlow(100).constructor.constructor === Function;
    `, 'true')

    await ses.shouldHaveReply(`>
      Buffer.allocUnsafe(100).toString('hex') +
      Buffer.allocUnsafeSlow(100).toString('hex');
    `, '00'.repeat(200))

    await ses.shouldHaveReply('> test.buffer.inspect()', `<Buffer ${'01 '.repeat(50)}... 950 more bytes>`)
    await ses.shouldHaveReply('> Buffer.from(Array(51).fill(1)).inspect()', `<Buffer ${'01 '.repeat(50)}... 1 more byte>`)
  })
})
