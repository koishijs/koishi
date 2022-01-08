import { App } from 'koishi'
import { expect } from 'chai'
import {} from 'chai-shape'
import jest from 'jest-mock'
import mock, { DEFAULT_SELF_ID } from '@koishijs/plugin-mock'
import * as forward from '@koishijs/plugin-forward'

const app = new App().plugin(mock)

const session2 = app.mock.client('123', '456')
const session3 = app.mock.client('789', '654')

app.plugin(forward, [{
  source: 'mock:456',
  destination: 'mock:654',
  selfId: DEFAULT_SELF_ID,
}])

before(() => app.start())

describe('Relay Plugin', () => {
  it('basic support', async () => {
    const send = app.bots[0].sendMessage = jest.fn(async () => '2000')
    await session2.shouldNotReply('hello')
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls).to.have.shape([['654', '123: hello']])
    send.mockClear()

    await session3.shouldNotReply('hello')
    expect(send.mock.calls).to.have.length(0)
    await session3.shouldNotReply('[CQ:quote,id=2000] hello')
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls).to.have.shape([['456', '789: hello']])
    send.mockClear()

    send.mockImplementation(async () => '3000')
    await session2.shouldNotReply('[CQ:quote,id=3000] hello')
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls).to.have.shape([['654', '123: hello']])
  })
})
