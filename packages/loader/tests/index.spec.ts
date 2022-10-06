import { expect } from 'chai'
import { Context } from 'koishi'
import Loader from './utils'

describe('@koishijs/loader', () => {
  const loader = new Loader()

  it('loader.createApp()', async () => {
    loader.config = {
      prefix: '.',
      plugins: {
        'foo': {},
        'group:qux': {
          'bar': {
            a: 1,
          },
        },
      },
    }

    const app = await loader.createApp()
    expect(app).to.be.instanceof(Context)
    expect(app.config.prefix).to.deep.equal(['.'])
    expect(app.registry.get(loader.data.foo)).to.be.ok
    expect(app.registry.get(loader.data.foo)?.config).to.deep.equal({})
    expect(app.registry.get(loader.data.bar)).to.be.ok
    expect(app.registry.get(loader.data.bar)?.config).to.deep.equal({ a: 1 })
  })

  it('app.state.update()', async () => {
    const { app } = loader
    loader.config = {
      prefix: '/',
      plugins: {
        'group:qux': {
          'baz': {},
          'bar': {
            a: 2,
          },
        },
      },
    }
    app.state.update(loader.config)
    await app.lifecycle.flush()
    expect(app.config.prefix).to.deep.equal(['/'])
    expect(app.registry.get(loader.data.foo)).to.be.not.ok
    expect(app.registry.get(loader.data.bar)).to.be.ok
    expect(app.registry.get(loader.data.bar)?.config).to.deep.equal({ a: 2 })
    expect(app.registry.get(loader.data.baz)).to.be.ok
    expect(app.registry.get(loader.data.baz)?.config).to.deep.equal({})
  })

  it('plugin update', async () => {
    const { app } = loader
    const runtime = app.registry.get(loader.data.bar)
    runtime?.update({ a: 3 })
    expect(loader.config.plugins).to.deep.equal({
      'group:qux': {
        'baz': {},
        'bar': {
          a: 3,
        },
      },
    })
  })
})
