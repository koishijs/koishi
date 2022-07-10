import { App, Middleware, sleep, noop, Logger, Next } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import * as jest from 'jest-mock'

const app = new App()
app.plugin(mock)

const midLogger = new Logger('session')
const midWarn = jest.spyOn(midLogger, 'warn')

export function createArray<T>(length: number, create: (index: number) => T) {
  return [...new Array(length).keys()].map(create)
}

before(() => app.start())

before(() => Logger.levels.base = 1)
after(() => Logger.levels.base = 2)

describe('Middleware Runtime', () => {
  let callSequence: jest.Mock[]

  beforeEach(() => {
    app.$internal._hooks = []
    callSequence = []
  })

  function wrap<T extends (...args: any[]) => any>(callback: T) {
    const wrapper = jest.fn((...args: Parameters<T>) => {
      callSequence.push(wrapper)
      return callback.apply(null, args) as ReturnType<T>
    })
    return wrapper
  }

  it('run asynchronously', async () => {
    const mid1 = wrap<Middleware>((_, next) => sleep(0).then(() => next()))
    const mid2 = wrap<Middleware>((_, next) => next())
    app.middleware(mid1)
    app.middleware(mid2)
    await app.mock.client('123').receive('foo')
    expect(callSequence).to.deep.equal([mid1, mid2])
  })

  it('stop when no next is called', async () => {
    const mid1 = wrap<Middleware>(noop)
    const mid2 = wrap<Middleware>((_, next) => next())
    app.middleware(mid1)
    app.middleware(mid2)
    expect(callSequence).to.deep.equal([])
    await app.mock.client('123').receive('foo')
    expect(callSequence).to.deep.equal([mid1])
  })

  it('prepend middleware', async () => {
    const mid1 = wrap<Middleware>((_, next) => next())
    const mid2 = wrap<Middleware>((_, next) => next())
    const mid3 = wrap<Middleware>((_, next) => next())
    app.middleware(mid1)
    app.middleware(mid2, true)
    app.middleware(mid3, true)
    await app.mock.client('123').receive('foo')
    expect(callSequence).to.deep.equal([mid3, mid2, mid1])
  })

  it('temporary middleware', async () => {
    type NextCallback = Extract<Next.Callback, (...args: any[]) => any>

    const mid1 = wrap<Middleware>((_, next) => next(mid3))
    const mid2 = wrap<Middleware>((_, next) => next(mid4))
    const mid3 = wrap<NextCallback>((next) => next(mid5))
    const mid4 = wrap<NextCallback>((next) => next())
    const mid5 = wrap<NextCallback>((next) => next())
    app.middleware(mid1)
    app.middleware(mid2)
    await app.mock.client('123').receive('foo')
    expect(callSequence).to.deep.equal([mid1, mid2, mid3, mid4, mid5])
  })

  it('middleware error', async () => {
    midWarn.mockClear()
    const errorMessage = 'error message'
    app.middleware(() => { throw new Error(errorMessage) })
    await app.mock.client('123').receive('foo')
    expect(midWarn.mock.calls).to.have.length(1)
  })

  it('isolated next function', async () => {
    midWarn.mockClear()
    app.middleware((_, next) => (next(), undefined))
    app.middleware((_, next) => sleep(0).then(() => next()))
    await app.mock.client('123').receive('foo')
    await sleep(0)
    expect(midWarn.mock.calls).to.have.length(1)
  })
})
