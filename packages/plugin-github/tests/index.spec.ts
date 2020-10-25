import { App, BASE_SELF_ID } from 'koishi-test-utils'
import { install, InstalledClock } from '@sinonjs/fake-timers'
import { Random } from 'koishi-utils'
import { fn, Mock, spyOn } from 'jest-mock'
import { expect } from 'chai'
import { readdirSync } from 'fs-extra'
import { resolve } from 'path'
import nock from 'nock'
import * as github from 'koishi-plugin-github'

const app = new App({
  port: 10000,
  prefix: '.',
  mockDatabase: true,
})

app.plugin(github, {
  secret: Random.uuid(),
  repos: { 'koishijs/koishi': [123] },
})

const session1 = app.session(123)
const session2 = app.session(456)

// override listen
const listen = spyOn(app.server, 'listen')
listen.mockReturnValue(Promise.resolve())

// spy on sendGroupMsg
const sendGroupMsg = app.bots[0].sendGroupMsg = fn()

before(async () => {
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getUser(456, 3)
  await app.database.getGroup(123, BASE_SELF_ID)
})

const snapshot = require('./index.snap')

const apiScope = nock('https://api.github.com')
const tokenInterceptor = nock('https://github.com').post('/login/oauth/access_token')

const ghAccessToken = Random.uuid()
const ghRefreshToken = Random.uuid()
const payload = {
  access_token: ghAccessToken,
  refresh_token: ghRefreshToken,
}

describe('GitHub Plugin', () => {
  let clock: InstalledClock

  before(() => {
    clock = install()
  })

  after(() => {
    clock.runAll()
    clock.uninstall()
  })

  describe('Basic Support', () => {
    it('authorize server', async () => {
      tokenInterceptor.reply(200, payload)
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

    it('github.authorize', async () => {
      await session1.shouldReply('github.authorize', '请输入用户名。')
      await session1.shouldReply('github.authorize satori', /^请点击下面的链接继续操作：/)
    })

    it('github.recent', async () => {
      await session1.shouldReply('github.recent', '最近没有 GitHub 通知。')
    })
  })

  let counter = 0x100000
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
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}]`)
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] .noop`)
    })

    it('link', async () => {
      await session1.shouldReply(
        `[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] .link`,
        'https://github.com/koishijs/koishi/issues/19#issuecomment-576277946',
      )
    })

    type MockedReplyCallback = (err: NodeJS.ErrnoException, result: nock.ReplyFnResult) => void
    type MockedReply = Mock<void, [uri: string, body: nock.Body, callback: MockedReplyCallback]>

    const mockResponse = (uri: string, payload: nock.ReplyFnResult) => {
      const mock: MockedReply = fn((uri, body, callback) => callback(null, payload))
      apiScope.post(uri).reply(mock)
      return mock
    }

    it('react', async () => {
      const reaction = mockResponse('/repos/koishijs/koishi/issues/comments/576277946/reactions', [200])
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] laugh`)
      expect(reaction.mock.calls).to.have.length(1)
    })

    it('reply', async () => {
      const comment = mockResponse('/repos/koishijs/koishi/issues/19/comments', [200])
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] test`)
      expect(comment.mock.calls).to.have.length(1)
    })

    it('token not found', async () => {
      await session2.shouldReply(
        `[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] test`,
        '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。',
      )
      await session2.shouldReply('satori', /^请点击下面的链接继续操作：/)
    })

    it('request error', async () => {
      apiScope.post('/repos/koishijs/koishi/issues/19/comments').replyWithError('foo')
      await session1.shouldReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] test`, '发送失败。')
    })

    it('refresh token', async () => {
      const unauthorized = mockResponse('/repos/koishijs/koishi/issues/19/comments', [401])
      tokenInterceptor.reply(401)
      await session1.shouldReply(
        `[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] test`,
        '令牌已失效，需要重新授权。输入你的 GitHub 用户名。',
      )
      expect(unauthorized.mock.calls).to.have.length(1)
      await session1.shouldReply('', '输入超时。')
    })

    it('reauthorize', async () => {
      const unauthorized = mockResponse('/repos/koishijs/koishi/issues/19/comments', [401])
      tokenInterceptor.reply(200, payload)
      const notFound = mockResponse('/repos/koishijs/koishi/issues/19/comments', [404])
      await session1.shouldReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] [CQ:at,qq=${BASE_SELF_ID}] test`, '发送失败。')
      expect(unauthorized.mock.calls).to.have.length(1)
      expect(notFound.mock.calls).to.have.length(1)
    })

    it('github.recent', async () => {
      await session1.shouldReply('github.recent', /^100001\./)
    })
  })
})
