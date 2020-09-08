import { App, BASE_SELF_ID } from 'koishi-test-utils'
import { Random } from 'koishi-utils'
import { fn, spyOn } from 'jest-mock'
import { expect } from 'chai'
import { readdirSync } from 'fs-extra'
import { resolve } from 'path'
import nock from 'nock'
import * as github from 'koishi-plugin-github'

const app = new App({
  port: 10000,
  mockDatabase: true,
})

app.plugin(github, {
  secret: Random.uuid(),
  repos: { 'koishijs/koishi': [123] },
})

const session = app.session(123)

// override listen
const listen = spyOn(app.server, 'listen')
listen.mockReturnValue(Promise.resolve())

// spy on sendGroupMsg
const sendGroupMsg = app.bots[0].sendGroupMsg = fn()

before(async () => {
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getGroup(123, BASE_SELF_ID)
})

const snapshot = require('./index.snap')

describe('GitHub Plugin', () => {
  it('authorize server', async () => {
    const ghAccessToken = Random.uuid()
    const ghRefreshToken = Random.uuid()
    const interceptor = nock('https://github.com').post('/login/oauth/access_token')
    interceptor.reply(200, {
      access_token: ghAccessToken,
      refresh_token: ghRefreshToken,
    })

    await expect(app.server.get('/github/authorize')).to.eventually.have.property('code', 400)
    await expect(app.server.get('/github/authorize?state=123')).to.eventually.have.property('code', 200)
    await expect(app.database.getUser(123)).to.eventually.have.shape({
      ghAccessToken,
      ghRefreshToken,
    })
  })

  it('webhook server', async () => {
    await expect(app.server.post('/github/webhook', {})).to.eventually.have.property('code', 400)
  })

  it('github command', async () => {
    await session.shouldReply('github', '请输入用户名。')
    await session.shouldReply('github satori', /^请点击下面的链接继续操作：/)
  })

  let counter = 10000
  const idMap: Record<string, number> = {}

  describe('Webhook Events', () => {
    const files = readdirSync(resolve(__dirname, 'fixtures'))
    files.forEach((file) => {
      const title = file.slice(0, -5)
      it(title, async () => {
        sendGroupMsg.mockClear()
        sendGroupMsg.mockImplementation(() => {
          return Promise.resolve(idMap[title] = ++counter)
        })

        const payload = require(`./fixtures/${title}`)
        const [name] = title.split('.', 1)
        await app.github.receive({ id: Random.uuid(), name, payload })
        if (snapshot[title]) {
          expect(sendGroupMsg.mock.calls).to.have.length(1)
          expect(sendGroupMsg.mock.calls[0][1]).to.equal(snapshot[title].trim())
        } else {
          expect(sendGroupMsg.mock.calls).to.have.length(0)
        }
      })
    })
  })

  describe('Quick Interactions', () => {
    it('no operation', async () => {
      await session.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}]`)
      await session.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] .noop`)
    })

    it('link', async () => {
      await session.shouldReply(
        `[CQ:reply,id=${idMap['issue_comment.created.1']}] .link`,
        'https://github.com/koishijs/koishi/issues/19#issuecomment-576277946',
      )
    })
  })
})
