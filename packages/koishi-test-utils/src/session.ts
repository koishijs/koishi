import { Session as Meta, ResponsePayload, App } from 'koishi-core'
import { MockedApp } from './app'
import { expect } from 'chai'

export const createMessageMeta = (app: App, type: 'user' | 'group', message: string, userId: number, ctxId: number) => new Meta(app, {
  [type + 'Id']: ctxId,
  postType: 'message',
  messageType: type === 'user' ? 'private' : type,
  message,
  userId,
  sender: {
    sex: 'unknown',
    age: 0,
    userId,
    nickname: '' + userId,
  },
})

export class TestSession {
  meta: Meta

  constructor(public app: MockedApp, public type: 'user' | 'group', public userId: number, public ctxId: number) {
    this.meta = createMessageMeta(app, type, null, userId, ctxId)
  }

  async send(message: string) {
    const replies: string[] = []
    async function $send(message: string) {
      if (message) replies.push(message)
    }
    await this.app.receiveMessage(new Meta(this.app, { ...this.meta, message, $send }))
    return replies
  }

  async shouldHaveReply(message: string, reply?: string) {
    const replies = await this.send(message)
    const lastReply = replies[replies.length - 1]
    if (reply) {
      return expect(lastReply).to.equal(reply)
    } else {
      return expect(lastReply).to.be.ok
    }
  }

  shouldHaveNoReply(message: string) {
    return expect(this.send(message)).to.eventually.have.length(0)
  }

  shouldMatchSnapshot(message: string) {
    // TODO
    // return expect(this.send(message)).resolves.toMatchSnapshot(message)
  }
}
