import { App, Bot } from 'koishi'
import * as echo from '@koishijs/plugin-echo'
import mock from '@koishijs/plugin-mock'
import * as jest from 'jest-mock'
import { expect, use } from 'chai'
import shape from 'chai-shape'

use(shape)

const app = new App()

app.plugin(mock)
app.plugin(echo)

const client = app.mock.client('123')

before(() => app.start())

describe('@koishijs/plugin-echo', () => {
  it('basic support', async () => {
    await client.shouldReply('echo', '请输入要发送的文本。')
    await client.shouldReply('echo foo', 'foo')
    await client.shouldReply('echo -E &lt;&gt;', '<>')
    await client.shouldReply('echo -A foo', '<anonymous/>foo')
    await client.shouldReply('echo -a foo', '<anonymous ignore/>foo')

    const send1 = app.bots[0].sendPrivateMessage = jest.fn<Bot['sendPrivateMessage']>()
    await client.shouldNotReply('echo -u @100 foo')
    expect(send1.mock.calls).to.have.shape([['100', 'foo']])

    const send2 = app.bots[0].sendMessage = jest.fn<Bot['sendMessage']>()
    await client.shouldNotReply('echo -c #200 foo')
    expect(send2.mock.calls).to.have.shape([['200', 'foo']])
  })
})
