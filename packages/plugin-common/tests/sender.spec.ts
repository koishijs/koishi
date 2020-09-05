import { App } from 'koishi-test-utils'
import { fn } from 'jest-mock'
import { expect } from 'chai'
import sender from '../src/sender'

const app = new App({ mockDatabase: true })
const session = app.session(123)

app.plugin(sender)

before(async () => {
  await app.database.getUser(123, 4)
  await app.database.getGroup(456, 514)
})

describe('Sender Commands', () => {
  it('echo', async () => {
    await session.shouldReply('echo', '请输入要发送的文本。')
    await session.shouldReply('echo foo', 'foo')
    await session.shouldReply('echo -e &#91;&#93;', '[]')
    await session.shouldReply('echo -A foo', '[CQ:anonymous]foo')
    await session.shouldReply('echo -a foo', '[CQ:anonymous,ignore=true]foo')
  })

  it('broadcast', async () => {
    const sendGroupMsg = app.bots[0].sendGroupMsg = fn()
    await session.shouldReply('broadcast', '请输入要发送的文本。')
    expect(sendGroupMsg.mock.calls).to.have.length(0)
    await session.shouldNotReply('broadcast foo')
    expect(sendGroupMsg.mock.calls).to.have.length(1)
    await session.shouldNotReply('broadcast -o foo')
    expect(sendGroupMsg.mock.calls).to.have.length(2)
    await session.shouldNotReply('broadcast -of foo')
    expect(sendGroupMsg.mock.calls).to.have.length(3)
  })
})
