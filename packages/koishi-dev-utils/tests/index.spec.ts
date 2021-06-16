import { Session } from 'koishi-core'
import { App } from 'koishi-test-utils'
import { Plugin, PluginContext, Middleware, Event, User, Channel, Apply, Command, Usage, Example } from 'koishi-dev-utils'
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
    @User.Except('456')
    @Middleware()
    hello(session: Session) {
      return session.send(this.state.config.text)
    }

    @Event('disconnect')
    onDisconnect() {
      callback2()
    }

    @Command('echo [text]')
    @User.Field(['flag'])
    @Channel.Field(['flag'])
    @Usage('usage')
    @Example('echo lalala')
    echo(_, text: string) {
      return text
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

  it('command', async () => {
    await ses1.shouldReply('echo foo', 'foo')
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
