import { SERVER_URL, CLIENT_PORT, createServer, postMeta } from 'koishi-test-utils'
import { App, Meta } from '../src'
import { Server } from 'http'
import { sleep } from 'koishi-utils'
import * as errors from '../src/errors'

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

    app.premiddleware((_, next) => {
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
})
