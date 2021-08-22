import { Dialogue, apply } from 'koishi-plugin-teach'
import { App } from 'koishi-test-utils'

export default function (config: Dialogue.Config) {
  const app = new App({
    nickname: ['koishi', 'satori'],
    mockDatabase: true,
  })

  const u2id = '200', u3id = '300', u4id = '400'
  const g1id = '100', g2id = '200'
  const u2 = app.session(u2id)
  const u3 = app.session(u3id)
  const u4 = app.session(u4id)
  const u2g1 = app.session(u2id, g1id)
  const u2g2 = app.session(u2id, g2id)
  const u3g1 = app.session(u3id, g1id)
  const u3g2 = app.session(u3id, g2id)
  const u4g1 = app.session(u4id, g1id)
  const u4g2 = app.session(u4id, g2id)

  app.plugin(apply, {
    historyAge: 0,
    useContext: false,
    useTime: false,
    useWriter: false,
    successorTimeout: 0,
    ...config,
  })

  async function start() {
    await app.start()
    await app.database.initUser(u2id, 2)
    await app.database.initUser(u3id, 3)
    await app.database.initUser(u4id, 4)
    await app.database.initChannel(g1id)
    await app.database.initChannel(g2id)
  }

  before(start)

  return { app, u2, u3, u4, u2g1, u2g2, u3g1, u3g2, u4g1, u4g2, start }
}
