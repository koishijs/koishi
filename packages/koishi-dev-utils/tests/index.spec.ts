import { NextFunction, Session } from 'koishi-core'
import { App } from 'koishi-test-utils'
import { Plugin, PluginContext, Middleware, Event, User } from 'koishi-dev-utils'
import { expect } from 'chai'
import jest from 'jest-mock'

describe('Plugin Context', () => {
  const fn = jest.fn()

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
      fn()
    }
  }

  const app = new App().plugin(new MyPlugin(), { text: 'hello!' })
  const ses1 = app.session('123')
  const ses2 = app.session('456')

  it('middleware', async () => {
    await ses1.shouldReply('say hello', 'hello!')
  })

  it('selector', async () => {
    await ses2.shouldNotReply('say hello')
  })

  it('event', async () => {
    expect(fn.mock.calls).to.have.length(0)
    app.emit('disconnect')
    expect(fn.mock.calls).to.have.length(1)
  })
})
