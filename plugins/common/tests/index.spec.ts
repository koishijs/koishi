import { App } from '@koishijs/test-utils'
import { expect } from 'chai'
import jest from 'jest-mock'
import * as common from '@koishijs/plugin-common'
import memory from '@koishijs/plugin-database-memory'

const app = new App({
  delay: { broadcast: 0 },
})

app.plugin(memory)

const session1 = app.session('123')
const session2 = app.session('123', '456')

app.plugin(common, {
  operator: 'mock:999',
  respondent: [{
    match: '挖坑一时爽',
    reply: '填坑火葬场',
  }, {
    match: /^(.+)一时爽$/,
    reply: (_, action) => `一直${action}一直爽`,
  }],
})

app.command('show-context')
  .userFields(['mock'])
  .channelFields(['id'])
  .action(({ session }) => {
    return `${session.userId},${session.user?.mock},${session.channel?.id}`
  })

before(async () => {
  await app.initUser('123', 4)
  await app.initUser('456', 3)
  await app.initUser('789', 5)
  await app.initChannel('456')
})

describe('Common Plugin - Basic', () => {
  it('broadcast', async () => {
    const send = app.bots[0].sendMessage = jest.fn()
    await session1.shouldReply('broadcast', '请输入要发送的文本。')
    expect(send.mock.calls).to.have.length(0)
    await session1.shouldNotReply('broadcast foo')
    expect(send.mock.calls).to.have.length(1)
    await session1.shouldNotReply('broadcast -o foo')
    expect(send.mock.calls).to.have.length(2)
    await session1.shouldNotReply('broadcast -of foo')
    expect(send.mock.calls).to.have.length(4)
  })

  describe('contextify', () => {
    it('check input', async () => {
      await session1.shouldReply('ctxf -u @456', '请输入要触发的指令。')
      await session1.shouldReply('ctxf -m @456 show-context', '无法在私聊上下文使用 --member 选项。')
      await session2.shouldReply('ctxf show-context', '请提供新的上下文。')
      await session2.shouldReply('ctxf -u @789 show-context', '权限不足。')
    })

    it('private context', async () => {
      await session1.shouldReply('ctxf -u @456 show-context', '456,456,undefined')
      await session1.shouldReply('ctxf -c #456 show-context', '123,123,mock:456')
      await session1.shouldReply('ctxf -u @456 -c #456 show-context', '456,456,mock:456')
    })

    it('group context', async () => {
      await session2.shouldReply('ctxf -u @456 show-context', '456,456,undefined')
      await session2.shouldReply('ctxf -m @456 show-context', '456,456,mock:456')
    })
  })

  it('echo', async () => {
    await session1.shouldReply('echo', '请输入要发送的文本。')
    await session1.shouldReply('echo foo', 'foo')
    await session1.shouldReply('echo -e &#91;&#93;', '[]')
    await session1.shouldReply('echo -A foo', '[CQ:anonymous]foo')
    await session1.shouldReply('echo -a foo', '[CQ:anonymous,ignore=true]foo')

    const send1 = app.bots[0].sendPrivateMessage = jest.fn()
    await session1.shouldNotReply('echo -u @100 foo')
    expect(send1.mock.calls).to.have.shape([['100', 'foo']])

    const send2 = app.bots[0].sendMessage = jest.fn()
    await session1.shouldNotReply('echo -c #200 foo')
    expect(send2.mock.calls).to.have.shape([['200', 'foo']])
  })

  it('feedback', async () => {
    const send1 = app.bots[0].sendPrivateMessage = jest.fn(async () => '1000')
    await session1.shouldReply('feedback', '请输入要发送的文本。')
    expect(send1.mock.calls).to.have.length(0)
    await session1.shouldReply('feedback foo', '反馈信息发送成功！')
    expect(send1.mock.calls).to.have.length(1)
    expect(send1.mock.calls).to.have.shape([['999', '收到来自 123 的反馈信息：\nfoo']])

    const send2 = app.bots[0].sendMessage = jest.fn()
    await session1.shouldNotReply('bar')
    expect(send2.mock.calls).to.have.length(0)
    await session1.shouldNotReply(`[CQ:quote,id=1000] bar`)
    expect(send2.mock.calls).to.have.length(1)
    expect(send2.mock.calls).to.have.shape([['private:123', 'bar']])
  })

  it('recall', async () => {
    const del = app.bots[0].deleteMessage = jest.fn()
    await session2.shouldReply('recall', '近期没有发送消息。')
    app.receive(app.bots[0].createSession({ messageId: '1234', channelId: '456', guildId: '456' }).toJSON())
    await session2.shouldNotReply('recall')
    expect(del.mock.calls).to.have.shape([[session2.meta.channelId, '1234']])
  })

  it('respondents', async () => {
    await session1.shouldReply('挖坑一时爽', '填坑火葬场')
    await session1.shouldReply('填坑一时爽', '一直填坑一直爽')
    await session1.shouldNotReply('填坑一直爽')
  })
})
