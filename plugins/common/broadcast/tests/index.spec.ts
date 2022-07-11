import { App, Bot, Channel } from 'koishi'
import * as broadcast from '@koishijs/plugin-broadcast'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import * as jest from 'jest-mock'
import { expect } from 'chai'

const app = new App({
  delay: { broadcast: 0 },
})

app.plugin(mock, { selfId: '514' })
app.plugin(mock, { selfId: '114' })
app.plugin(memory)
app.plugin(broadcast)

const client = app.mock.client('123')

before(async () => {
  await app.start()
  await app.mock.initUser('123', 4)
  await app.mock.initChannel('111', '114')
  await app.mock.initChannel('222', '514')
  await app.mock.initChannel('333', '514', { flag: Channel.Flag.silent })
  await app.mock.initChannel('444', '810')
})

describe('@koishijs/plugin-broadcast', () => {
  it('basic support', async () => {
    const send = jest.fn<Bot['sendMessage']>(async () => [])
    app.bots.forEach(bot => bot.sendMessage = send)

    await client.shouldReply('broadcast', '请输入要发送的文本。')
    expect(send.mock.calls).to.have.length(0)

    await client.shouldNotReply('broadcast foo')
    expect(send.mock.calls).to.have.length(2)
    expect(send.mock.calls[0][0]).to.equal('222')
    expect(send.mock.calls[1][0]).to.equal('111')
    send.mockClear()

    await client.shouldNotReply('broadcast -o foo')
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls[0][0]).to.equal('222')
    send.mockClear()

    await client.shouldNotReply('broadcast -of foo')
    expect(send.mock.calls).to.have.length(2)
    expect(send.mock.calls[0][0]).to.equal('222')
    expect(send.mock.calls[1][0]).to.equal('333')
  })
})
