import { App, SessionError, Middleware, sleep, noop, Logger, Next } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import { mock as jest, Mock } from 'node:test'

type NextCallback = Extract<Next.Callback, (...args: any[]) => any>

const app = new App()
app.plugin(mock)

const print = jest.fn()
const client = app.mock.client('123')

before(() => app.start())

before(() => {
  Logger.levels.base = 1
  Logger.targets.push({
    levels: { base: 0, session: 2 },
    print,
  })
})

after(() => {
  Logger.levels.base = 2
  Logger.targets.pop()
})

describe('Middleware Runtime', () => {
  let callSequence: Mock<() => void>[]

  beforeEach(() => {
    print.mock.resetCalls()
    app.$processor._hooks = []
    callSequence = []
  })

  function trace<T extends (...args: any[]) => any>(callback: T) {
    const wrapper = jest.fn((...args: Parameters<T>) => {
      callSequence.push(wrapper)
      return callback.apply(null, args) as ReturnType<T>
    })
    return wrapper
  }

  it('basic 1 (next callback)', async () => {
    const mid1 = trace<Middleware>((_, next) => sleep(0).then(() => next()))
    const mid2 = trace<Middleware>((_, next) => 'bar')
    app.middleware(mid1)
    app.middleware(mid2)
    await client.shouldReply('foo', 'bar')
    expect(callSequence).to.deep.equal([mid1, mid2])
  })

  it('basic 2 (return empty string)', async () => {
    const mid1 = trace<Middleware>((_, next) => next())
    const mid2 = trace<Middleware>((_, next) => '')
    app.middleware(mid1)
    app.middleware(mid2)
    await client.shouldNotReply('foo')
    expect(callSequence).to.deep.equal([mid1, mid2])
  })

  it('basic 3 (early termination)', async () => {
    const mid1 = trace<Middleware>(noop)
    const mid2 = trace<Middleware>((_, next) => 'bar')
    app.middleware(mid1)
    app.middleware(mid2)
    await client.shouldNotReply('foo')
    expect(callSequence).to.deep.equal([mid1])
  })

  it('basic 4 (prepend middleware)', async () => {
    const mid1 = trace<Middleware>((_, next) => next())
    const mid2 = trace<Middleware>((_, next) => next())
    const mid3 = trace<Middleware>((_, next) => next())
    app.middleware(mid1)
    app.middleware(mid2, true)
    app.middleware(mid3, true)
    await client.shouldNotReply('foo')
    expect(callSequence).to.deep.equal([mid3, mid2, mid1])
  })

  it('next 1 (parameter)', async () => {
    const mid1 = trace<Middleware>((_, next) => next('bar'))
    const mid2 = trace<Middleware>((_, next) => next('baz'))
    app.middleware(mid1)
    app.middleware(mid2)
    await client.shouldReply('foo', 'bar')
    expect(callSequence).to.deep.equal([mid1, mid2])
  })

  it('next 2 (callback)', async () => {
    const mid1 = trace<Middleware>((_, next) => next(() => 'bar'))
    const mid2 = trace<Middleware>((_, next) => next(() => 'baz'))
    app.middleware(mid1)
    app.middleware(mid2)
    await client.shouldReply('foo', 'bar')
    expect(callSequence).to.deep.equal([mid1, mid2])
  })

  it('next 3 (compose)', async () => {
    const mid1 = trace<Middleware>((_, next) => next(mid3))
    const mid2 = trace<Middleware>((_, next) => next(mid4))
    const mid3 = trace<NextCallback>((next) => next(mid5))
    const mid4 = trace<NextCallback>((next) => next())
    const mid5 = trace<NextCallback>((next) => next())
    app.middleware(mid1)
    app.middleware(mid2)
    await client.shouldNotReply('foo')
    expect(callSequence).to.deep.equal([mid1, mid2, mid3, mid4, mid5])
  })

  const path = 'internal.low-authority'

  it('error 1 (middleware error)', async () => {
    app.middleware(() => { throw new Error(path) })
    await client.shouldNotReply('foo')
    expect(print.mock.calls).to.have.length(1)
  })

  it('error 2 (next error)', async () => {
    app.middleware((_, next) => next(() => { throw new Error(path) }))
    await client.shouldNotReply('foo')
    expect(print.mock.calls).to.have.length(1)
  })

  it('error 3 (error message)', async () => {
    app.middleware(() => { throw new SessionError(path) })
    await client.shouldReply('foo', '权限不足。')
    expect(print.mock.calls).to.have.length(0)
  })

  it('edge case 1 (isolated next)', async () => {
    app.middleware((_, next) => (next(), undefined))
    app.middleware((_, next) => sleep(0).then(() => next()))
    await client.shouldNotReply('foo')
    await sleep(0)
    expect(print.mock.calls).to.have.length(1)
  })

  it('edge case 2 (stack exceeded)', async () => {
    const compose = (next: Next) => next(compose)
    app.middleware((_, next) => next(compose))
    await client.shouldNotReply('foo')
    await sleep(0)
    expect(print.mock.calls).to.have.length(1)
  })
})
