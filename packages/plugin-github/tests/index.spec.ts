import { App } from 'koishi-test-utils'
import { Random } from 'koishi-core'
import { expect } from 'chai'
import { readdirSync } from 'fs-extra'
import { resolve } from 'path'
import nock from 'nock'
import jest from 'jest-mock'
import * as github from 'koishi-plugin-github'
import { Method } from 'axios'

const app = new App({
  port: 10000,
  prefix: '.',
  mockStart: false,
  mockDatabase: true,
})

app.plugin(github)

const ses = app.session('123', '999')
const ses2 = app.session('456', '999')
const ses3 = app.session('123')

// override start
const start = jest.spyOn(app.server, 'start')
start.mockReturnValue(Promise.resolve())

before(async () => {
  app.database.memory.$store.github = []
  await app.database.initUser('123', 3)
  await app.database.initUser('456', 3)
  await app.database.createChannel('mock', '999', {
    assignee: app.bots[0].selfId,
    githubWebhooks: { 'koishijs/koishi': {} },
  })
  await app.start()
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
      await ses.shouldReply('.github.authorize', '请输入用户名。')
      await ses.shouldReply('.github.authorize satori', /^请点击下面的链接继续操作：/)
      await expect(app.server.get('/github/authorize?state=foo-bar-baz')).to.eventually.have.property('code', 200)
      await expect(app.database.getUser('mock', '123')).to.eventually.have.shape({
        ghAccessToken,
        ghRefreshToken,
      })
      uuid.mockRestore()
    })

    it('github.repos (handle errors)', async () => {
      await ses.shouldReply('.github.repos', '当前没有监听的仓库。')
      await ses.shouldReply('.github.repos -d', '请输入仓库名。')
      await ses.shouldReply('.github.repos -d foo', '请输入正确的仓库名。')

      apiScope.post('/repos/foo/bar/hooks').reply(404)
      await ses.shouldReply('.github.repos -a foo/bar', '仓库不存在或您无权访问。')
      apiScope.post('/repos/foo/bar/hooks').reply(403)
      await ses.shouldReply('.github.repos -a foo/bar', '第三方访问受限，请尝试授权此应用。\nhttps://docs.github.com/articles/restricting-access-to-your-organization-s-data/')
      apiScope.post('/repos/foo/bar/hooks').reply(400)
      await ses.shouldReply('.github.repos -a foo/bar', '由于未知原因添加仓库失败。')
    })

    it('github (check context)', async () => {
      await ses3.shouldReply('.github', /^github\nGitHub 相关功能/)
      await ses3.shouldReply('.github -l', '当前不是群聊上下文。')
      await ses3.shouldReply('.github -a foo/bar', '当前不是群聊上下文。')
      await ses.shouldReply('.github -l', 'koishijs/koishi')
    })

    it('github (auto create)', async () => {
      await ses.shouldReply('.github -a', '请输入仓库名。')
      await ses.shouldReply('.github -a foo', '请输入正确的仓库名。')
      await ses.shouldReply('.github -a koishijs/koishi', '已经在当前频道订阅过仓库 koishijs/koishi。')
      await ses.shouldReply('.github -a foo/bar', '尚未添加过仓库 foo/bar。发送空行或句号以立即添加并订阅该仓库。')
      apiScope.post('/repos/foo/bar/hooks').reply(200, { id: 999 })
      await ses.shouldReply('.', '添加订阅成功！')
      await ses.shouldReply('.github.repos -a foo/bar', '已经添加过仓库 foo/bar。')
    })

    it('github.repos (remove repo)', async () => {
      apiScope.delete('/repos/foo/bar/hooks/999').reply(403)
      await ses.shouldReply('.github.repos -d foo/bar', '移除仓库失败。')
      apiScope.delete('/repos/foo/bar/hooks/999').reply(200)
      await ses.shouldReply('.github.repos -d foo/bar', '移除仓库成功！')
      await ses.shouldReply('.github.repos -d foo/bar', '尚未添加过仓库 foo/bar。')
    })

    it('github.repos (add repo)', async () => {
      await ses.shouldReply('.github.repos -l', '当前没有监听的仓库。')
      apiScope.post('/repos/koishijs/koishi/hooks').reply(200, { id: 999 })
      await ses.shouldReply('.github.repos -a koishijs/koishi', '添加仓库成功！')
      await ses.shouldReply('.github.repos -l', 'koishijs/koishi')
    })

    it('github (unsubscribe repo)', async () => {
      await ses.shouldReply('.github -d foo/bar', '移除订阅成功！')
      await ses.shouldReply('.github -d foo/bar', '尚未在当前频道订阅过仓库 foo/bar。')
    })

    it('github.issue', async () => {
      await ses.shouldReply('.github.issue', '请输入仓库名。')
      await ses.shouldReply('.github.issue -r foo', '请输入正确的仓库名。')
      apiScope.post('/repos/koishijs/koishi/issues').reply(200)
      await ses.shouldReply('.github.issue -r koishijs/koishi foo bar', '创建成功！')
    })

    it('github.star', async () => {
      await ses.shouldReply('.github.star', '请输入仓库名。')
      await ses.shouldReply('.github.star -r foo', '请输入正确的仓库名。')
      apiScope.put('/user/starred/koishijs/koishi').reply(200)
      await ses.shouldReply('.github.star -r koishijs/koishi', '创建成功！')
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
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}]`)
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] .noop`)
    })

    it('link', async () => {
      await ses.shouldReply(
        `[CQ:quote,id=${idMap['issue_comment.created.1']}] .link`,
        'https://github.com/koishijs/koishi/issues/19#issuecomment-576277946',
      )
    })

    type MockedReplyCallback = (err: NodeJS.ErrnoException, result: nock.ReplyFnResult) => void
    type MockedReply = jest.Mock<void, [uri: string, body: nock.Body, callback: MockedReplyCallback]>

    const mockResponse = (method: Method, uri: string, payload: nock.ReplyFnResult) => {
      const mock: MockedReply = jest.fn((uri, body, callback) => callback(null, payload))
      apiScope.intercept('/repos/koishijs/koishi' + uri, method).reply(mock)
      return mock
    }

    it('react', async () => {
      const reaction = mockResponse('POST', '/issues/comments/576277946/reactions', [200])
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] laugh`)
      expect(reaction.mock.calls).to.have.length(1)
    })

    it('reply', async () => {
      const comment = mockResponse('POST', '/issues/19/comments', [200])
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] test`)
      expect(comment.mock.calls).to.have.length(1)
    })

    it('close', async () => {
      const api1 = mockResponse('PATCH', '/issues/20', [200])
      const api2 = mockResponse('POST', '/issues/20/comments', [200])
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .close foo`)
      expect(api1.mock.calls).to.have.length(1)
      expect(api2.mock.calls).to.have.length(1)
    })

    it('base', async () => {
      const api = mockResponse('PATCH', '/pulls/20', [200])
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .base foo`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('merge', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .merge`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('rebase', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .rebase`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('squash', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await ses.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .squash`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('token not found', async () => {
      await ses2.shouldReply(
        `[CQ:quote,id=${idMap['issue_comment.created.1']}] test`,
        '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。',
      )
      await ses2.shouldReply('satori', /^请点击下面的链接继续操作：/)
    })

    it('request error', async () => {
      apiScope.post('/repos/koishijs/koishi/issues/19/comments').replyWithError('foo')
      await ses.shouldReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] test`, '发送失败。')
    })

    it('refresh token', async () => {
      const unauthorized = mockResponse('POST', '/issues/19/comments', [401])
      tokenInterceptor.reply(401)
      await ses.shouldReply(
        `[CQ:quote,id=${idMap['issue_comment.created.1']}] test`,
        '令牌已失效，需要重新授权。输入你的 GitHub 用户名。',
      )
      expect(unauthorized.mock.calls).to.have.length(1)
      await ses.shouldReply('', '输入超时。')
    })

    it('reauthorize', async () => {
      const unauthorized = mockResponse('POST', '/issues/19/comments', [401])
      tokenInterceptor.reply(200, payload)
      const notFound = mockResponse('POST', '/issues/19/comments', [404])
      await ses.shouldReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] test`, '发送失败。')
      expect(unauthorized.mock.calls).to.have.length(1)
      expect(notFound.mock.calls).to.have.length(1)
    })
  })
})
