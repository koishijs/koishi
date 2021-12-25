import { App } from 'koishi'
import * as teach from '@koishijs/plugin-teach'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'

export default function (config: teach.Config) {
  const app = new App({
    nickname: ['koishi', 'satori'],
  })

  app.plugin(mock)
  app.plugin(memory)

  const u2id = '200', u3id = '300', u4id = '400'
  const g1id = '100', g2id = '200'
  const u2 = app.mock.client(u2id)
  const u3 = app.mock.client(u3id)
  const u4 = app.mock.client(u4id)
  const u2g1 = app.mock.client(u2id, g1id)
  const u2g2 = app.mock.client(u2id, g2id)
  const u3g1 = app.mock.client(u3id, g1id)
  const u3g2 = app.mock.client(u3id, g2id)
  const u4g1 = app.mock.client(u4id, g1id)
  const u4g2 = app.mock.client(u4id, g2id)

  app.plugin(teach, {
    historyTimeout: 0,
    useContext: false,
    useTime: false,
    useWriter: false,
    successorTimeout: 0,
    ...config,
  })

  async function start() {
    await app.start()
    await app.mock.initUser(u2id, 2)
    await app.mock.initUser(u3id, 3)
    await app.mock.initUser(u4id, 4)
    await app.mock.initChannel(g1id)
    await app.mock.initChannel(g2id)
  }

  async function stop() {
    await app.database.drop()
    await app.stop()
  }

  before(start)
  after(stop)

  return { app, u2, u3, u4, u2g1, u2g2, u3g1, u3g2, u4g1, u4g2, start, stop }
}
