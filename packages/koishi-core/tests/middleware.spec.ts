import { MockedApp, createArray } from 'koishi-test-utils'
import { Middleware, NextFunction, Context } from 'koishi-core'
import { sleep, noop, Logger } from 'koishi-utils'
import { Mock, fn } from 'jest-mock'
import { expect } from 'chai'

const app = new MockedApp()
let callSequence: Mock<any, any[]>[]
let middlewares: [Context, Middleware][]

function wrap<T extends (...args: any[]) => any>(callback: T) {
  const wrapper = fn((...args: Parameters<T>) => {
    callSequence.push(wrapper)
    return callback.apply(null, args) as ReturnType<T>
  })
  return wrapper
}

beforeEach(() => {
  middlewares = app._hooks[Context.MIDDLEWARE_EVENT as any] = []
  callSequence = []
})

Logger.baseLevel = 1
const appLogger = new Logger('app')
const appWarn = appLogger.warn = fn(appLogger.warn)
const midLogger = new Logger('middleware')
const midWarn = midLogger.warn = fn(midLogger.warn)

describe('Middleware API', () => {
  const extraCalls = 7

  it('max middlewares', async () => {
    appWarn.mockClear()
    createArray(64 + extraCalls, () => app.addMiddleware(noop))
    expect(middlewares.length).to.equal(64 + extraCalls)
    expect(appWarn.mock.calls).to.have.length(extraCalls)
  })

  it('max prepended middlewares', () => {
    appWarn.mockClear()
    createArray(64 + extraCalls, () => app.prependMiddleware(noop))
    expect(middlewares.length).to.equal(64 + extraCalls)
    expect(appWarn.mock.calls).to.have.length(extraCalls)
  })

  it('remove middlewares', () => {
    app.addMiddleware(noop)
    expect(middlewares.length).to.equal(1)
    expect(app.removeMiddleware(noop)).to.be.ok
    expect(middlewares.length).to.equal(0)
    expect(app.removeMiddleware(noop)).not.to.be.ok
    expect(middlewares.length).to.equal(0)
  })
})

describe('Middleware Runtime', () => {
  it('run asynchronously', async () => {
    const mid1 = wrap<Middleware>((_, next) => sleep(0).then(() => next()))
    const mid2 = wrap<Middleware>((_, next) => next())
    app.addMiddleware(mid1)
    app.addMiddleware(mid2)
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).to.deep.equal([mid1, mid2])
  })

  it('stop when no next is called', async () => {
    const mid1 = wrap<Middleware>(noop)
    const mid2 = wrap<Middleware>((_, next) => next())
    app.addMiddleware(mid1)
    app.addMiddleware(mid2)
    expect(callSequence).to.deep.equal([])
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).to.deep.equal([mid1])
  })

  it('prepend addMiddleware', async () => {
    const mid1 = wrap<Middleware>((_, next) => next())
    const mid2 = wrap<Middleware>((_, next) => next())
    const mid3 = wrap<Middleware>((_, next) => next())
    app.addMiddleware(mid1)
    app.prependMiddleware(mid2)
    app.prependMiddleware(mid3)
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).to.deep.equal([mid3, mid2, mid1])
  })

  it('temporary middleware', async () => {
    const mid1 = wrap<Middleware>((_, next) => next(mid3))
    const mid2 = wrap<Middleware>((_, next) => next(mid4))
    const mid3 = wrap<NextFunction>((next) => next(mid5))
    const mid4 = wrap<NextFunction>((next) => next())
    const mid5 = wrap<NextFunction>((next) => next())
    app.addMiddleware(mid1)
    app.addMiddleware(mid2)
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).to.deep.equal([mid1, mid2, mid3, mid4, mid5])
  })

  it('middleware error', async () => {
    midWarn.mockClear()
    const errorMessage = 'error message'
    app.addMiddleware(() => { throw new Error(errorMessage) })
    await app.receiveMessage('user', 'foo', 123)
    expect(midWarn.mock.calls).to.have.length(1)
  })

  it('isolated next function', async () => {
    midWarn.mockClear()
    app.addMiddleware((_, next) => (next(), undefined))
    app.addMiddleware((_, next) => sleep(0).then(() => next()))
    await app.receiveMessage('user', 'foo', 123)
    await sleep(0)
    expect(midWarn.mock.calls).to.have.length(1)
  })
})
