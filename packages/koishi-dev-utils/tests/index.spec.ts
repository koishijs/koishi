import { Session } from 'koishi-core'
import { App } from 'koishi-test-utils'
import { Plugin, PluginContext, Middleware } from 'koishi-dev-utils'

describe('Plugin Context', () => {
  @Plugin('test-1')
  class MyPlugin extends PluginContext {
    @Middleware
    hello(session: Session) {
      session.send('hello!')
    }
  }

  const app = new App().plugin(new MyPlugin())
  const sess = app.session('123')

  it('middleware', async () => {
    await sess.shouldReply('say hello', 'hello!')
  })
})
