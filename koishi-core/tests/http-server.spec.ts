import { SERVER_URL, CLIENT_PORT, createServer, postMeta } from './utils'
import { App, startAll, stopAll } from '../src'
import { Server } from 'http'

let app1: App, app2: App, app3: App
let server: Server

jest.setTimeout(1000)

beforeAll(() => {
  server = createServer()

  app1 = new App({
    type: 'http',
    port: CLIENT_PORT,
    server: SERVER_URL,
    selfId: 514,
  })

  app2 = new App({
    type: 'http',
    port: CLIENT_PORT,
    server: SERVER_URL,
    selfId: 515,
  })

  app3 = new App({
    type: 'http',
    port: CLIENT_PORT + 1,
    server: SERVER_URL,
    selfId: 516,
    secret: 'secret',
  })

  startAll()
})

afterAll(() => {
  stopAll()
  server.close()
})

describe('http server', () => {
  const mocks: jest.Mock[] = []
  for (let index = 0; index < 3; ++index) {
    mocks.push(jest.fn())
  }

  beforeAll(() => {
    app1.receiver.on('message', mocks[0])
    app2.receiver.on('message', mocks[1])
    app3.receiver.on('message', mocks[2])
  })

  test('request validation', async () => {
    await expect(postMeta({
      postType: 'message',
      userId: 10000,
      selfId: 516,
      messageType: 'private',
      subType: 'friend',
      message: 'Hello',
    }, CLIENT_PORT + 1)).rejects.toHaveProperty('message', 'Request failed with status code 401')

    await expect(postMeta({
      postType: 'message',
      userId: 10000,
      selfId: 516,
      messageType: 'private',
      subType: 'friend',
      message: 'Hello',
    }, CLIENT_PORT + 1, 'foobar')).rejects.toHaveProperty('message', 'Request failed with status code 403')

    await expect(postMeta({
      postType: 'message',
      userId: 10000,
      selfId: 516,
      messageType: 'private',
      subType: 'friend',
      message: 'Hello',
    }, CLIENT_PORT + 1, 'secret')).resolves.toHaveProperty('status', 200)
  })

  test('app binding', async () => {
    await postMeta({
      postType: 'message',
      userId: 10000,
      selfId: 514,
      messageType: 'private',
      subType: 'friend',
      message: 'Hello',
    })

    expect(mocks[0]).toBeCalledTimes(1)
    expect(mocks[1]).toBeCalledTimes(0)

    await postMeta({
      postType: 'message',
      userId: 10000,
      selfId: 515,
      messageType: 'private',
      subType: 'friend',
      message: 'Hello',
    })

    expect(mocks[0]).toBeCalledTimes(1)
    expect(mocks[1]).toBeCalledTimes(1)

    await expect(postMeta({
      postType: 'message',
      userId: 10000,
      selfId: 516,
      messageType: 'private',
      subType: 'friend',
      message: 'Hello',
    })).rejects.toHaveProperty('message', 'Request failed with status code 403')
  })
})
