import { App } from 'koishi-test-utils'
import { Random } from 'koishi-utils'
import { expect } from 'chai'
import { readdirSync } from 'fs-extra'
import { resolve } from 'path'
import nock from 'nock'
import jest from 'jest-mock'
import * as github from 'koishi-plugin-github'

const app = new App({
  port: 10000,
  prefix: '.',
  mockDatabase: true,
  userCacheAge: Number.EPSILON,
  channelCacheAge: Number.EPSILON,
})

app.plugin(github, {
  secret: Random.uuid(),
  repos: { 'koishijs/koishi': ['mock:999'] },
})

const session1 = app.session('123', '999')
const session2 = app.session('456', '999')

// override start
const start = jest.spyOn(app.server, 'start')
start.mockReturnValue(Promise.resolve())

before(async () => {
  await app.start()
  await app.database.initUser('123', 3)
  await app.database.initUser('456', 3)
  await app.database.initChannel('999')
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
  describe('Basic Support', () => {
    it('authorize server', async () => {
      tokenInterceptor.reply(200, payload)
      await expect(app.server.get('/github/authorize')).to.eventually.have.property('code', 400)
      await expect(app.server.get('/github/authorize?state=123')).to.eventually.have.property('code', 403)
      await expect(app.server.get('/github/authorize?state=123&state=456')).to.eventually.have.property('code', 400)
    })

    it('webhook server', async () => {
      await expect(app.server.post('/github/webhook', {})).to.eventually.have.property('code', 400)
    })

    it('github.authorize', async () => {
      const uuid = jest.spyOn(Random, 'uuid')
      uuid.mockReturnValue('foo-bar-baz')
      await session1.shouldReply('.github.authorize', '请输入用户名。')
      await session1.shouldReply('.github.authorize satori', /^请点击下面的链接继续操作：/)
      await expect(app.server.get('/github/authorize?state=foo-bar-baz')).to.eventually.have.property('code', 200)
      await expect(app.database.getUser('mock', '123')).to.eventually.have.shape({
        ghAccessToken,
        ghRefreshToken,
      })
      uuid.mockRestore()
    })

    it('github.recent', async () => {
      await session1.shouldReply('.github.recent', '最近没有 GitHub 通知。')
    })
  })

  const idMap: Record<string, string> = {}

  describe('Webhook Events', () => {
    // spy on sendMessage
    const sendMessage = app.bots[0].sendMessage = jest.fn()

    const files = readdirSync(resolve(__dirname, 'fixtures'))
    files.forEach((file) => {
      const title = file.slice(0, -5)
      it(title, async () => {
        sendMessage.mockClear()
        sendMessage.mockImplementation(() => {
          return Promise.resolve(idMap[title] = Random.uuid())
        })

        const payload = require(`./fixtures/${title}`)
        const [event] = title.split('.', 1)
        const fullEvent = payload.action ? `${event}/${payload.action}` : event
        if (payload.action) {
          app.emit(`github/${fullEvent}` as any, payload)
        }
        app.emit(`github/${event}` as any, payload)

        // wait until all messages are sent
        await new Promise(resolve => process.nextTick(resolve))
        if (snapshot[title]) {
          expect(sendMessage.mock.calls).to.have.length(1)
          expect(sendMessage.mock.calls[0][1]).to.equal(snapshot[title].trim())
        } else {
          expect(sendMessage.mock.calls).to.have.length(0)
        }
      })
    })
  })

  describe('Quick Interactions', () => {
    it('no operation', async () => {
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}]`)
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] .noop`)
    })

    it('link', async () => {
      await session1.shouldReply(
        `[CQ:quote,id=${idMap['issue_comment.created.1']}] .link`,
        'https://github.com/koishijs/koishi/issues/19#issuecomment-576277946',
      )
    })

    type MockedReplyCallback = (err: NodeJS.ErrnoException, result: nock.ReplyFnResult) => void
    type MockedReply = jest.Mock<void, [uri: string, body: nock.Body, callback: MockedReplyCallback]>

    const mockResponse = (uri: string, payload: nock.ReplyFnResult) => {
      const mock: MockedReply = jest.fn((uri, body, callback) => callback(null, payload))
      apiScope.post(uri).reply(mock)
      return mock
    }

    it('react', async () => {
      const reaction = mockResponse('/repos/koishijs/koishi/issues/comments/576277946/reactions', [200])
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] laugh`)
      expect(reaction.mock.calls).to.have.length(1)
    })

    it('reply', async () => {
      const comment = mockResponse('/repos/koishijs/koishi/issues/19/comments', [200])
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] test`)
      expect(comment.mock.calls).to.have.length(1)
    })

    it('close', async () => {
      const api1 = mockResponse('/repos/koishijs/koishi/issues/20', [200])
      const api2 = mockResponse('/repos/koishijs/koishi/issues/20/comments', [200])
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .close foo`)
      expect(api1.mock.calls).to.have.length(1)
      expect(api2.mock.calls).to.have.length(1)
    })

    it('base', async () => {
      const api = mockResponse('/repos/koishijs/koishi/pulls/20', [200])
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .base foo`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('merge', async () => {
      const api = mockResponse('/repos/koishijs/koishi/pulls/20/merge', [200])
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .merge`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('rebase', async () => {
      const api = mockResponse('/repos/koishijs/koishi/pulls/20/merge', [200])
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .rebase`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('squash', async () => {
      const api = mockResponse('/repos/koishijs/koishi/pulls/20/merge', [200])
      await session1.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .squash`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('token not found', async () => {
      await session2.shouldReply(
        `[CQ:quote,id=${idMap['issue_comment.created.1']}] test`,
        '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。',
      )
      await session2.shouldReply('satori', /^请点击下面的链接继续操作：/)
    })

    it('request error', async () => {
      apiScope.post('/repos/koishijs/koishi/issues/19/comments').replyWithError('foo')
      await session1.shouldReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] test`, '发送失败。')
    })

    it('refresh token', async () => {
      const unauthorized = mockResponse('/repos/koishijs/koishi/issues/19/comments', [401])
      tokenInterceptor.reply(401)
      await session1.shouldReply(
        `[CQ:quote,id=${idMap['issue_comment.created.1']}] test`,
        '令牌已失效，需要重新授权。输入你的 GitHub 用户名。',
      )
      expect(unauthorized.mock.calls).to.have.length(1)
      await session1.shouldReply('', '输入超时。')
    })

    it('reauthorize', async () => {
      const unauthorized = mockResponse('/repos/koishijs/koishi/issues/19/comments', [401])
      tokenInterceptor.reply(200, payload)
      const notFound = mockResponse('/repos/koishijs/koishi/issues/19/comments', [404])
      await session1.shouldReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] test`, '发送失败。')
      expect(unauthorized.mock.calls).to.have.length(1)
      expect(notFound.mock.calls).to.have.length(1)
    })

    it('github.recent', async () => {
      await session1.shouldReply('.github.recent', /^\w{6}\./)
    })
  })
})
