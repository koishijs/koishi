import { SERVER_URL, CLIENT_PORT, createServer, postMeta } from 'koishi-test-utils/src/http-server'
import { App, Meta } from '../src'
import { Server } from 'http'
import { sleep, noop } from 'koishi-utils'
import { errors } from '../src/messages'
import { format } from 'util'

let app: App
let server: Server

jest.setTimeout(1000)

const shared: Meta = {
  postType: 'message',
  userId: 10000,
  selfId: 514,
}

beforeAll(() => {
  server = createServer()

  app = new App({
    type: 'http',
    port: CLIENT_PORT,
    server: SERVER_URL,
    selfId: 514,
  })

  app.start()
})

afterAll(() => {
  server.close()
  app.stop()
})

describe('middleware', () => {
  let flag: number

  beforeEach(() => flag = 0)

  beforeAll(() => {
    app.users.middleware((_, next) => {
      flag |= 1 << 1
      return next()
    })

    app.groups.middleware(({ message }, next) => {
      flag |= 1 << 2
      if (message === 'foo') return
      if (message === 'bar') return next()
      return next(() => (flag |= 1 << 4, undefined))
    })

    app.middleware(({ message }, next) => {
      flag |= 1 << 3
      if (message === 'foo') return next()
      if (message === 'bar') return
      return next(next => (flag |= 1 << 5, next(() => (flag |= 1 << 6, undefined))))
    })

    app.prependMiddleware((_, next) => {
      flag |= 1 << 0
      return next()
    })
  })

  test('middleware-1', async () => {
    await postMeta({
      ...shared,
      messageType: 'private',
      subType: 'friend',
      message: 'foo',
    })

    expect(flag.toString(2).split('').reverse().join('')).toBe('1101')
  })

  test('middleware-2', async () => {
    await postMeta({
      ...shared,
      messageType: 'group',
      subType: 'normal',
      message: 'bar',
      groupId: 20000,
    })

    expect(flag.toString(2).split('').reverse().join('')).toBe('1011')
  })

  test('middleware-3', async () => {
    await postMeta({
      ...shared,
      messageType: 'private',
      subType: 'friend',
      message: 'baz',
    })

    expect(flag.toString(2).split('').reverse().join('')).toBe('1101011')
  })

  test('middleware-4', async () => {
    await postMeta({
      ...shared,
      messageType: 'group',
      subType: 'normal',
      message: 'baz',
      groupId: 20000,
    })

    expect(flag.toString(2).split('').reverse().join('')).toBe('10111')
  })
})

describe('runtime checks', () => {
  beforeEach(() => {
    // @ts-ignore
    app._middlewares = [[app, app._preprocess]]
  })

  test('isolated next function', async () => {
    const errorCallback = jest.fn()
    const middlewareErrorCallback = jest.fn()
    app.receiver.on('error', error => errorCallback(error.message))
    app.receiver.on('error/middleware', error => middlewareErrorCallback(error.message))

    app.middleware(async (_, next) => {
      next()
    })

    app.middleware(async (_, next) => {
      await sleep(0)
      next()
    })

    await postMeta({
      ...shared,
      messageType: 'group',
      subType: 'normal',
      message: 'bar',
    })

    await sleep(0)

    expect(errorCallback).toBeCalledTimes(1)
    expect(errorCallback).toBeCalledWith(errors.ISOLATED_NEXT)
    expect(middlewareErrorCallback).toBeCalledTimes(0)
  })

  test('middleware error', async () => {
    const errorCallback = jest.fn()
    const middlewareErrorCallback = jest.fn()
    app.receiver.on('error', error => errorCallback(error.message))
    app.receiver.on('error/middleware', error => middlewareErrorCallback(error.message))

    const errorMessage = 'error message'
    app.middleware(() => {
      throw new Error(errorMessage)
    })

    await postMeta({
      ...shared,
      messageType: 'group',
      subType: 'normal',
      message: 'bar',
    })

    await sleep(0)

    expect(errorCallback).toBeCalledTimes(1)
    expect(errorCallback).toBeCalledWith(errorMessage)
    expect(middlewareErrorCallback).toBeCalledTimes(1)
    expect(middlewareErrorCallback).toBeCalledWith(errorMessage)
  })

  test('max middlewares', () => {
    const mock = jest.fn()
    app.receiver.on('error', mock)

    const extraCalls = 7
    for (let index = 0; index < 63 + extraCalls; ++index) {
      app.middleware(noop)
    }

    expect(app._middlewares.length).toBe(64)
    expect(mock).toBeCalledTimes(extraCalls)
    expect(mock.mock.calls[0][0]).toHaveProperty('message', format(errors.MAX_MIDDLEWARES, 64))
  })

  test('max prepended middlewares', () => {
    const mock = jest.fn()
    app.receiver.on('error', mock)

    const extraCalls = 7
    for (let index = 0; index < 63 + extraCalls; ++index) {
      app.prependMiddleware(noop)
    }

    expect(app._middlewares.length).toBe(64)
    expect(mock).toBeCalledTimes(extraCalls)
    expect(mock.mock.calls[0][0]).toHaveProperty('message', format(errors.MAX_MIDDLEWARES, 64))
  })

  test('remove middlewares', () => {
    const fn = () => {}
    app.middleware(fn)
    expect(app._middlewares.length).toBe(2)
    expect(app.removeMiddleware(fn)).toBeTruthy()
    expect(app._middlewares.length).toBe(1)
    expect(app.removeMiddleware(fn)).toBeFalsy()
    expect(app._middlewares.length).toBe(1)
  })
})
