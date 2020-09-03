import { expect } from 'chai'
/* eslint-disable no-eval */
/* eslint-disable no-void */
/* eslint-env mocha */
/* eslint-disable no-new-wrappers, max-len */

import { VM } from 'koishi-plugin-eval/src/vm'
import { inspect } from 'util'

describe('Eval Sandbox (Frozen)', () => {
  const vm = new VM()

  vm.internal.setGlobal('test', {
    null: null,
    undefined: undefined,
    string: 'text',
    number: 1,
    boolean: true,
    stringO: new String('text'),
    numberO: new Number(1),
    booleanO: new Boolean(true),
    date: new Date(),
    regexp: /xxx/,
    buffer1: Buffer.from(Array(1000).fill(1)),
    buffer2: Buffer.from(Array(51).fill(1)),
    symbol1: Symbol('test'),
    symbol2: Symbol.for('test'),
    symbol3: Symbol.iterator,
    error: new Error('test'),
    rangeError: new RangeError('test'),
    syntaxError: new SyntaxError('test'),
    referenceError: new ReferenceError('test'),
    typeError: new TypeError('test'),
    evalError: new EvalError('test'),
    uriError: new URIError('test'),
    object: {
      foo: 0,
    },
    function() {
      return () => ({})
    },
  })

  it('contextify', () => {
    expect(vm.run('test.null === null')).to.be.true
    expect(vm.run('test.undefined === undefined')).to.be.true
    expect(vm.run('test.string.constructor === String')).to.be.true
    expect(vm.run('test.number.constructor === Number')).to.be.true
    expect(vm.run('test.boolean.constructor === Boolean')).to.be.true
    expect(vm.run('test.stringO instanceof String')).to.be.true
    expect(vm.run('test.numberO instanceof Number')).to.be.true
    expect(vm.run('test.booleanO instanceof Boolean')).to.be.true
    expect(vm.run('test.date instanceof Date')).to.be.true
    expect(vm.run('test.regexp instanceof RegExp')).to.be.true
    expect(vm.run('test.buffer1 instanceof Buffer')).to.be.true
    expect(vm.run('test.buffer2 instanceof Buffer')).to.be.true
    expect(vm.run('test.error instanceof Error')).to.be.true
    expect(vm.run('test.rangeError instanceof RangeError')).to.be.true
    expect(vm.run('test.syntaxError instanceof SyntaxError')).to.be.true
    expect(vm.run('test.referenceError instanceof ReferenceError')).to.be.true
    expect(vm.run('test.typeError instanceof TypeError')).to.be.true
    expect(vm.run('test.evalError instanceof EvalError')).to.be.true
    expect(vm.run('test.uriError instanceof URIError')).to.be.true
    expect(vm.run('test.object instanceof Object')).to.be.true
  })

  it('function', () => {
    expect(vm.run('test.function instanceof Function')).to.be.true
    expect(vm.run('test.function() instanceof Function')).to.be.true
    expect(vm.run('test.function()() instanceof Object')).to.be.true
    expect(inspect(vm.run('test.function'))).to.equal('[Function: function]')
    expect(vm.run('test.function.toString()')).to.equal('function function() { [native code] }')
  })

  it('symbol', () => {
    expect(vm.run('Symbol.for("test") === test.symbol2')).to.be.true
    expect(vm.run('test.symbol1.constructor.constructor === Function')).to.be.true
    expect(vm.run('test.symbol2.constructor.constructor === Function')).to.be.true
    expect(vm.run('test.symbol3.constructor.constructor === Function')).to.be.true
    expect(vm.run('Symbol("test").constructor.constructor === Function')).to.be.true
    expect(vm.run('Symbol("foobar").constructor.constructor === Function')).to.be.true
    expect(vm.run('Symbol.keyFor(test.symbol2)')).to.equal('test')
  })

  it('host inspect', () => {
    expect(inspect(vm.run('[1, 2]'))).to.equal(inspect([1, 2]))
    expect(inspect(vm.run('new Set([1, 2])'))).to.equal(inspect(new Set([1, 2])))
    expect(inspect(vm.run('new Map([[1, 2]])'))).to.equal(inspect(new Map([[1, 2]])))
    expect(inspect(vm.run('new WeakSet([[1]])'))).to.equal(inspect(new WeakSet([[1]])))
    expect(inspect(vm.run('new WeakMap([[[1], 2]])'))).to.equal(inspect(new WeakMap([[[1], 2]])))
    expect(inspect(vm.run('new RegExp()'))).to.equal(inspect(new RegExp(undefined)))
    expect(inspect(vm.run('Proxy'))).to.equal(inspect(Proxy))
    expect(inspect(vm.run('test.object'))).to.equal(inspect({ foo: 0 }))
  })

  it('buffer operations', () => {
    expect(vm.run('Buffer.allocUnsafe(100).constructor.constructor === Function')).to.be.true
    expect(vm.run('Buffer.allocUnsafeSlow(100).constructor.constructor === Function')).to.be.true
    expect(vm.run('Buffer.allocUnsafe(100).toString("hex")')).to.equal('0'.repeat(200))
    expect(vm.run('Buffer.allocUnsafeSlow(100).toString("hex")')).to.equal('0'.repeat(200))
    expect(vm.run('test.buffer1.inspect()')).to.equal(`<Buffer ${'01 '.repeat(50)}... 950 more bytes>`)
    expect(vm.run('test.buffer2.inspect()')).to.equal(`<Buffer ${'01 '.repeat(50)}... 1 more byte>`)
  })

  it('frozen traps', () => {
    expect(vm.run('test.object.foo = 1')).to.equal(1)
    expect(vm.run('delete test.object.foo')).to.be.false
    expect(() => vm.run('Object.defineProperty(test.object, "foo", { value: 1 })')).to.throw('trap')
    expect(() => vm.run('Object.setPrototypeOf(test.object, null)')).to.throw('trap')
    expect(() => vm.run('Object.isExtensible(test.object)')).to.throw('trap')
    expect(() => vm.run('Object.preventExtensions(test.object)')).to.throw('trap')
    expect(vm.run('test.object.foo')).to.equal(0)
    expect(vm.run('Object.getPrototypeOf(test.object)')).to.be.ok
  })

  it('operations', () => {
    expect(() => vm.run('test.function.caller')).to.throw('strict')
  })

  it('deprecated properties', () => {
    expect(vm.run('Buffer.prototype.__defineGetter__ === {}.__defineGetter__')).to.be.true
    expect(vm.run('Buffer.prototype.__defineSetter__ === {}.__defineSetter__')).to.be.true
    expect(vm.run('Buffer.prototype.__lookupGetter__ === {}.__lookupGetter__')).to.be.true
    expect(vm.run('Buffer.prototype.__lookupSetter__ === {}.__lookupSetter__')).to.be.true
    expect(vm.run('test.buffer1.__defineGetter__ === {}.__defineGetter__')).to.be.true
    expect(vm.run('test.buffer1.__defineSetter__ === {}.__defineSetter__')).to.be.true
    expect(vm.run('test.buffer1.__lookupGetter__ === {}.__lookupGetter__')).to.be.true
    expect(vm.run('test.buffer1.__lookupSetter__ === {}.__lookupSetter__')).to.be.true
    expect(vm.run('test.function.__defineGetter__ === {}.__defineGetter__')).to.be.true
    expect(vm.run('test.function.__defineSetter__ === {}.__defineSetter__')).to.be.true
    expect(vm.run('test.function.__lookupGetter__ === {}.__lookupGetter__')).to.be.true
    expect(vm.run('test.function.__lookupSetter__ === {}.__lookupSetter__')).to.be.true

    expect(() => vm.run('Buffer.prototype.__defineGetter__("toString", () => {})')).to.throw('trap')
    expect(vm.run('global.__defineGetter__("foo", () => 123); global.foo')).to.equal(123)
    expect(vm.run('Buffer.from.__lookupGetter__("__proto__") === Object.prototype.__lookupGetter__.call(Buffer.from, "__proto__")')).to.be.true
  })
})

describe('Eval Sandbox (Normal)', () => {
  const vm = new VM()

  vm.internal.setGlobal('test1', {
    foo: 1,
  }, true)

  function throwError(): any {
    throw new Error('mock error')
  }

  function catchError(callback: Function) {
    try {
      callback()
    } catch (e) {
      return e
    }
  }

  vm.internal.setGlobal('test2', new Proxy({
    foo: 1,
  }, {
    deleteProperty: throwError,
    setPrototypeOf: throwError,
  }), true)

  it('delete property', () => {
    expect(vm.run('test1.foo')).to.equal(1)
    expect(vm.run('delete test1.foo')).to.be.true
    expect(vm.run('test1.foo')).to.be.undefined
    expect(vm.run('test2.foo')).to.equal(1)
    expect(catchError(() => vm.run('delete test2.foo')) instanceof Error).to.be.true
    expect(vm.run('test2.foo')).to.equal(1)
  })

  it('get/set prototype', () => {
    expect(() => vm.run('Object.setPrototypeOf(test1, null)')).to.throw('not allowed')
    expect(vm.run('Object.getPrototypeOf(test1) === Object.prototype')).to.be.true
    expect(() => vm.run('Object.setPrototypeOf(test2, null)')).to.throw('not allowed')
    expect(vm.run('Object.getPrototypeOf(test2) === Object.prototype')).to.be.true
  })
})
