import { App } from 'koishi'
import { expect } from 'chai'
import * as recall from '@koishijs/plugin-recall'
import mock from '@koishijs/plugin-mock'
import * as jest from 'jest-mock'
import 'chai-shape'

const app = new App()

app.plugin(mock)
app.plugin(recall)

const client = app.mock.client('123', '456')

before(() => app.start())

describe('@koishijs/plugin-recall', () => {
  it('basic support', async () => {
    const del = app.bots[0].deleteMessage = jest.fn()
    await client.shouldReply('recall', '近期没有发送消息。')
    const session = await app.bots[0].session({ messageId: '1234', channelId: '456', guildId: '456' })
    app.mock.receive(session)
    await client.shouldNotReply('recall')
    expect(del.mock.calls).to.have.shape([[client.meta.channelId, '1234']])
  })
})
