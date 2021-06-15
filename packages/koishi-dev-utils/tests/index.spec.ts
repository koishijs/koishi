import { NextFunction, Session } from 'koishi-core'
import { App } from 'koishi-test-utils'
import { Plugin, PluginContext, Middleware, Event, User, Apply } from 'koishi-dev-utils'
import { expect } from 'chai'
import jest from 'jest-mock'

describe('Plugin Context', () => {
  const callback1 = jest.fn()
  const callback2 = jest.fn()

  interface Config {
    text: string
  }

  @Plugin('test-1')
  class MyPlugin extends PluginContext<Config> {
    @User.except('456')
    @Middleware()
    hello(session: Session, next: NextFunction) {
      session.send(this.state.config.text)
    }

    @Event('disconnect')
    onDisconnect() {
      callback2()
    }

    @Apply
    custom() {
      callback1()
    }
  }

  const app = new App()
  const ses1 = app.session('123')
  const ses2 = app.session('456')

  it('apply', async () => {
    expect(callback1.mock.calls).to.have.length(0)
    app.plugin(new MyPlugin(), { text: 'hello!' })
    expect(callback1.mock.calls).to.have.length(1)
  })

  it('middleware', async () => {
    await ses1.shouldReply('say hello', 'hello!')
  })

  it('selector', async () => {
    await ses2.shouldNotReply('say hello')
  })

  it('event', async () => {
    expect(callback2.mock.calls).to.have.length(0)
    app.emit('disconnect')
    expect(callback2.mock.calls).to.have.length(1)
  })
})
