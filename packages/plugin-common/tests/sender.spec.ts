import { App } from 'koishi-test-utils'
import { fn } from 'jest-mock'
import { expect } from 'chai'
import { StrangerInfo } from 'koishi-core'
import { GroupMemberInfo } from 'koishi-adapter-onebot'
import * as common from 'koishi-plugin-common'

const app = new App({ mockDatabase: true })
const session1 = app.session(123)
const session2 = app.session(123, 456)

app.plugin(common, {
  operator: 999,
})

app.command('show-context')
  .userFields(['id'])
  .channelFields(['id'])
  .action(({ session }) => {
    return `${session.userId},${session.$user?.id},${session.$group?.id}`
  })

before(async () => {
  await app.database.getUser(123, 4)
  await app.database.getUser(456, 3)
  await app.database.getUser(789, 5)
  await app.database.getChannel(456, app.selfId)
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
    const sendGroupMsg = app.bots[0].sendGroupMsg = fn()
    await session1.shouldReply('broadcast', '请输入要发送的文本。')
    expect(sendGroupMsg.mock.calls).to.have.length(0)
    await session1.shouldNotReply('broadcast foo')
    expect(sendGroupMsg.mock.calls).to.have.length(1)
    await session1.shouldNotReply('broadcast -o foo')
    expect(sendGroupMsg.mock.calls).to.have.length(2)
    await session1.shouldNotReply('broadcast -of foo')
    expect(sendGroupMsg.mock.calls).to.have.length(3)
  })

  it('feedback', async () => {
    const sendPrivateMsg = app.bots[0].sendPrivateMsg = fn(async () => 1000)
    await session1.shouldReply('feedback', '请输入要发送的文本。')
    expect(sendPrivateMsg.mock.calls).to.have.length(0)
    await session1.shouldReply('feedback foo', '反馈信息发送成功！')
    expect(sendPrivateMsg.mock.calls).to.have.length(1)
    expect(sendPrivateMsg.mock.calls).to.have.shape([[999, '收到来自 123 的反馈信息：\nfoo']])

    sendPrivateMsg.mockClear()
    await session1.shouldNotReply('bar')
    expect(sendPrivateMsg.mock.calls).to.have.length(0)
    await session1.shouldNotReply(`[CQ:reply,id=1000] [CQ:at,qq=${app.selfId}] bar`)
    expect(sendPrivateMsg.mock.calls).to.have.length(1)
    expect(sendPrivateMsg.mock.calls).to.have.shape([[123, 'bar']])
  })

  describe('Contextify', () => {
    app.bots[0].getStrangerInfo = fn(async () => ({} as StrangerInfo))
    app.bots[0].getGroupMemberInfo = fn(async () => ({} as GroupMemberInfo))

    it('check input', async () => {
      await session1.shouldReply('ctxf -u 456', '请输入要触发的指令。')
      await session2.shouldReply('ctxf -m foo show-context', '未指定目标。')
      await session1.shouldReply('ctxf show-context', '请提供新的上下文。')
      await session1.shouldReply('ctxf -u 789 show-context', '权限不足。')
      await session1.shouldReply('ctxf -m 456 show-context', '无法在私聊上下文使用 --member 选项。')
    })

    it('user context', async () => {
      await session1.shouldReply('ctxf -u 456 show-context', '456,456,undefined')
      await session1.shouldReply('ctxf -g 456 show-context', '123,123,456')
      await session1.shouldReply('ctxf -u 456 -g 456 show-context', '456,456,456')
    })

    it('group context', async () => {
      await session2.shouldReply('ctxf -u 456 show-context', '456,456,undefined')
      await session2.shouldReply('ctxf -m 456 show-context', '456,456,456')
    })
  })
})
