import { App, BASE_SELF_ID } from 'koishi-test-utils'
import { Random } from 'koishi-utils'
import { fn, Mock, spyOn } from 'jest-mock'
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
    await session1.shouldReply('github', '请输入用户名。')
    await session1.shouldReply('github satori', /^请点击下面的链接继续操作：/)
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
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}]`)
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] .noop`)
    })

    it('link', async () => {
      await session1.shouldReply(
        `[CQ:reply,id=${idMap['issue_comment.created.1']}] .link`,
        'https://github.com/koishijs/koishi/issues/19#issuecomment-576277946',
      )
    })

    type MockedReplyCallback = (err: NodeJS.ErrnoException, result: nock.ReplyFnResult) => void
    type MockedReply = Mock<void, [uri: string, body: nock.Body, callback: MockedReplyCallback]>

    const api = nock('https://api.github.com')
    const mockResponse = (uri: string, payload: nock.ReplyFnResult) => {
      const mock: MockedReply = fn((uri, body, callback) => callback(null, payload))
      api.post(uri).reply(mock)
      return mock
    }

    const createReaction = mockResponse('/repos/koishijs/koishi/issues/comments/576277946/reactions', [200])
    const createComment = mockResponse('/repos/koishijs/koishi/issues/19/comments', [200])

    it('react', async () => {
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] laugh`)
      expect(createReaction.mock.calls).to.have.length(1)
      expect(createComment.mock.calls).to.have.length(0)
    })

    it('reply', async () => {
      await session1.shouldNotReply(`[CQ:reply,id=${idMap['issue_comment.created.1']}] test`)
      expect(createReaction.mock.calls).to.have.length(1)
      expect(createComment.mock.calls).to.have.length(1)
    })

    it('token not found', async () => {
      await session2.shouldReply(
        `[CQ:reply,id=${idMap['issue_comment.created.1']}] test`,
        '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。',
      )
      await session2.shouldReply('satori', /^请点击下面的链接继续操作：/)
    })
  })
})
