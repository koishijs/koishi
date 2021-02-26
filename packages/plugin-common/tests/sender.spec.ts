import { App } from 'koishi-test-utils'
import { expect } from 'chai'
import jest from 'jest-mock'
import * as common from 'koishi-plugin-common'

const app = new App({ mockDatabase: true })
const session1 = app.session('123')
const session2 = app.session('123', '456')

app.plugin(common, {
  operator: 'mock:999',
})

app.command('show-context')
  .userFields(['mock'])
  .channelFields(['id'])
  .action(({ session }) => {
    return `${session.userId},${session.user?.mock},${session.channel?.id}`
  })

before(async () => {
  await app.database.initUser('123', 4)
  await app.database.initUser('456', 3)
  await app.database.initUser('789', 5)
  await app.database.initChannel('456')
  await app.database.initChannel('654', '111')
})

describe('Sender Commands', () => {
  it('echo', async () => {
    await session1.shouldReply('echo', '请输入要发送的文本。')
    await session1.shouldReply('echo foo', 'foo')
    await session1.shouldReply('echo -e &#91;&#93;', '[]')
    await session1.shouldReply('echo -A foo', '[CQ:anonymous]foo')
    await session1.shouldReply('echo -a foo', '[CQ:anonymous,ignore=true]foo')
  })

  it('broadcast', async () => {
    const send = app.bots[0].sendMessage = jest.fn()
    await session1.shouldReply('broadcast', '请输入要发送的文本。')
    expect(send.mock.calls).to.have.length(0)
    await session1.shouldNotReply('broadcast foo')
    expect(send.mock.calls).to.have.length(1)
    await session1.shouldNotReply('broadcast -o foo')
    expect(send.mock.calls).to.have.length(2)
    await session1.shouldNotReply('broadcast -of foo')
    expect(send.mock.calls).to.have.length(3)
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

  describe('Contextify', () => {
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
})
