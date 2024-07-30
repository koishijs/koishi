import { App, Bot, Channel } from 'koishi'
import * as broadcast from '@koishijs/plugin-broadcast'
import memory from '@minatojs/driver-memory'
import mock from '@koishijs/plugin-mock'
import { mock as jest } from 'node:test'
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
    const send1 = jest.method(app.bots.find(bot => bot.selfId === '514')!, 'sendMessage')
    const send2 = jest.method(app.bots.find(bot => bot.selfId === '114')!, 'sendMessage')

    await client.shouldReply('broadcast', '请输入要发送的文本。')
    expect(send1.mock.calls).to.have.length(1)
    send1.mock.resetCalls()

    await client.shouldNotReply('broadcast foo')
    expect(send1.mock.calls).to.have.length(1)
    expect(send1.mock.calls[0].arguments[0]).to.equal('222')
    expect(send2.mock.calls).to.have.length(1)
    expect(send2.mock.calls[0].arguments[0]).to.equal('111')
    send1.mock.resetCalls()

    await client.shouldNotReply('broadcast -o foo')
    expect(send1.mock.calls).to.have.length(1)
    expect(send1.mock.calls[0].arguments[0]).to.equal('222')
    send1.mock.resetCalls()

    await client.shouldNotReply('broadcast -of foo')
    expect(send1.mock.calls).to.have.length(2)
    expect(send1.mock.calls[0].arguments[0]).to.equal('222')
    expect(send1.mock.calls[1].arguments[0]).to.equal('333')
  })
})
