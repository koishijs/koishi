import { App } from 'koishi'
import { expect, use } from 'chai'
import shape from 'chai-shape'
import * as jest from 'jest-mock'
import * as help from '@koishijs/plugin-help'
import memory from '@koishijs/plugin-database-memory'
import mock, { DEFAULT_SELF_ID } from '@koishijs/plugin-mock'
import * as forward from '@koishijs/plugin-forward'

use(shape)

const app = new App()

app.plugin(mock)
app.plugin(help)

const session2 = app.mock.client('123', '456')
const session3 = app.mock.client('789', '654')

app.plugin(forward, [{
  source: 'mock:456',
  target: 'mock:654',
  selfId: DEFAULT_SELF_ID,
}])

before(async () => {
  await app.start()
})

describe('@koishijs/plugin-forward', () => {
  it('basic support', async () => {
    const send = app.bots[0].sendMessage = jest.fn(async () => ['2000'])
    await session2.shouldNotReply('hello')
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls).to.have.shape([['654', '123: hello']])
    send.mockClear()

    await session3.shouldNotReply('hello')
    expect(send.mock.calls).to.have.length(0)
    await session3.shouldNotReply('<quote id=2000/> hello')
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls).to.have.shape([['456', '789: hello']])
    send.mockClear()

    send.mockImplementation(async () => ['3000'])
    await session2.shouldNotReply('<quote id=3000/> hello')
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls).to.have.shape([['654', '123: hello']])
  })

  it('command usage', async () => {
    app.plugin(memory)
    await app.lifecycle.flush()
    await app.mock.initUser('123', 3)

    await session2.shouldReply('forward', /设置消息转发/)
    await session2.shouldReply('forward add #123', '已成功添加目标频道 mock:123。')
    await session2.shouldReply('forward ls', '当前频道的目标频道列表为：\nmock:123')
    await session2.shouldReply('forward rm #123', '已成功移除目标频道 mock:123。')
    await session2.shouldReply('forward ls', '当前频道没有设置目标频道。')
    await session2.shouldReply('forward clear', '已成功移除全部目标频道。')
  })
})
