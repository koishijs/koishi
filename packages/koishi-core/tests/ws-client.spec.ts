import { SERVER_PORT, SERVER_URL } from 'koishi-test-utils'
import { App, startAll, stopAll, Meta, WsClient } from '../src'
import { Server } from 'ws'
import { snakeCase } from 'koishi-utils/src'

let app1: App, app2: App
let server: Server

jest.setTimeout(1000)

beforeAll(async () => {
  server = new Server({
    port: SERVER_PORT,
  })

  server.on('connection', (socket) => {
    socket.on('message', (data) => {
      const parsed = JSON.parse(data.toString())
      socket.send(JSON.stringify({
        echo: parsed.echo,
        retcode: 0,
        data: {},
      }))
    })
  })

  app1 = new App({
    type: 'ws',
    server: SERVER_URL,
    selfId: 514,
  })

  app2 = new App({
    type: 'ws',
    server: SERVER_URL,
    selfId: 515,
  })

  await startAll()
})

afterAll(() => {
  stopAll()
  server.close()
})

function postMeta (meta: Meta) {
  const data = JSON.stringify(snakeCase(meta))
  for (const socket of server.clients) {
    socket.send(data)
  }
  return Promise.all([app1, app2].map((app) => {
    return new Promise((resolve) => {
      (app.server as WsClient).socket.once('message', resolve)
    })
  }))
}

describe('websocket server', () => {
  const mocks: jest.Mock[] = []
  for (let index = 0; index < 3; ++index) {
    mocks.push(jest.fn())
  }

  beforeAll(() => {
    app1.receiver.on('message', mocks[0])
    app2.receiver.on('message', mocks[1])
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
  })

  test('send messages', async () => {
    await expect(app1.sender.sendPrivateMsg(20000, 'foo')).resolves.toBeUndefined()
    await expect(app2.sender.sendPrivateMsg(20000, 'bar')).resolves.toBeUndefined()
  })
})
