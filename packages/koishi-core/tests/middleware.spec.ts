import { MockedApp, createArray } from 'koishi-test-utils'
import { Middleware, NextFunction, Context } from 'koishi-core'
import { sleep, noop } from 'koishi-utils'

const app = new MockedApp()
let callSequence: jest.Mock[]
let middlewares: [Context, Middleware][]

function wrap <T extends (...args: any[]) => any>(callback: T) {
  const wrapper = jest.fn((...args: Parameters<T>) => {
    callSequence.push(wrapper)
    return callback(...args) as ReturnType<T>
  })
  return wrapper
}

beforeEach(() => {
  middlewares = app._hooks[Context.MIDDLEWARE_EVENT as any] = []
  callSequence = []
})

describe('Middleware API', () => {
  const extraCalls = 7

  test('max middlewares', async () => {
    const warnCallback = jest.fn()
    app.on('logger/warn', warnCallback)
    createArray(64 + extraCalls, () => app.addMiddleware(noop))
    expect(middlewares.length).toBe(64)
    expect(warnCallback).toBeCalledTimes(extraCalls)
  })

  test('max prepended middlewares', () => {
    const warnCallback = jest.fn()
    app.on('logger/warn', warnCallback)
    createArray(64 + extraCalls, () => app.prependMiddleware(noop))
    expect(middlewares.length).toBe(64)
    expect(warnCallback).toBeCalledTimes(extraCalls)
  })

  test('remove middlewares', () => {
    app.addMiddleware(noop)
    expect(middlewares.length).toBe(1)
    expect(app.removeMiddleware(noop)).toBeTruthy()
    expect(middlewares.length).toBe(0)
    expect(app.removeMiddleware(noop)).toBeFalsy()
    expect(middlewares.length).toBe(0)
  })
})

describe('Middleware Runtime', () => {
  test('run asynchronously', async () => {
    const mid1 = wrap<Middleware>((_, next) => sleep(0).then(() => next()))
    const mid2 = wrap<Middleware>((_, next) => next())
    app.addMiddleware(mid1)
    app.addMiddleware(mid2)
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).toEqual([mid1, mid2])
  })

  test('stop when no next is called', async () => {
    const mid1 = wrap<Middleware>(noop)
    const mid2 = wrap<Middleware>((_, next) => next())
    app.addMiddleware(mid1)
    app.addMiddleware(mid2)
    expect(callSequence).toEqual([])
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).toEqual([mid1])
  })

  test('prepend addMiddleware', async () => {
    const mid1 = wrap<Middleware>((_, next) => next())
    const mid2 = wrap<Middleware>((_, next) => next())
    const mid3 = wrap<Middleware>((_, next) => next())
    app.addMiddleware(mid1)
    app.prependMiddleware(mid2)
    app.prependMiddleware(mid3)
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).toEqual([mid3, mid2, mid1])
  })

  test('temporary middleware', async () => {
    const mid1 = wrap<Middleware>((_, next) => next(mid3))
    const mid2 = wrap<Middleware>((_, next) => next(mid4))
    const mid3 = wrap<NextFunction>((next) => next(mid5))
    const mid4 = wrap<NextFunction>((next) => next())
    const mid5 = wrap<NextFunction>((next) => next())
    app.addMiddleware(mid1)
    app.addMiddleware(mid2)
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).toEqual([mid1, mid2, mid3, mid4, mid5])
  })

  test('once middleware', async () => {
    const mid1 = wrap<Middleware>((_, next) => next())
    const mid2 = wrap<Middleware>((_, next) => next())
    app.addMiddleware(mid1)
    app.onceMiddleware(mid2)
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).toEqual([mid2, mid1])
    await app.receiveMessage('user', 'foo', 123)
    expect(callSequence).toEqual([mid2, mid1, mid1])
  })

  test('middleware error', async () => {
    const errorCallback = jest.fn()
    const middlewareErrorCallback = jest.fn()
    app.on('error', error => errorCallback(error.message))
    app.on('error/middleware', error => middlewareErrorCallback(error.message))
    const errorMessage = 'error message'
    app.addMiddleware(() => { throw new Error(errorMessage) })
    await app.receiveMessage('user', 'foo', 123)
    expect(errorCallback).toBeCalledTimes(1)
    expect(errorCallback).toBeCalledWith(errorMessage)
    expect(middlewareErrorCallback).toBeCalledTimes(1)
    expect(middlewareErrorCallback).toBeCalledWith(errorMessage)
  })

  test('isolated next function', async () => {
    const warnCallback = jest.fn()
    app.on('logger/warn', warnCallback)
    app.addMiddleware((_, next) => (next(), undefined))
    app.addMiddleware((_, next) => sleep(0).then(() => next()))
    await app.receiveMessage('user', 'foo', 123)
    await sleep(0)
    expect(warnCallback).toBeCalledTimes(1)
  })
})
