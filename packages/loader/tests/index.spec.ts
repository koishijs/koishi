import { expect } from 'chai'
import { Context } from 'koishi'
import * as jest from 'jest-mock'
import mock from '@koishijs/plugin-mock'
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
        'foo': {
          '$if': false,
        },
        'group:qux': {
          '$filter': {
            'user': 123,
          },
          'baz': {},
          'bar': {
            'a': 2,
            '$filter': {
              'channel': 789,
            },
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
      'foo': {
        '$if': false,
      },
      'group:qux': {
        '$filter': {
          'user': 123,
        },
        'baz': {},
        'bar': {
          'a': 3,
          '$filter': {
            'channel': 789,
          },
        },
      },
    })
  })

  it('filter', async () => {
    const { app } = loader
    app.plugin(mock)
    expect(app.lifecycle._hooks['test/bar']).to.have.length(1)
    expect(app.lifecycle._hooks['test/baz']).to.have.length(1)
    const bar = app.lifecycle._hooks['test/bar'][0][1] as jest.Mock
    const baz = app.lifecycle._hooks['test/baz'][0][1] as jest.Mock
    expect(bar.mock.calls).to.have.length(0)
    expect(baz.mock.calls).to.have.length(0)

    let { meta } = app.mock.client('123', '456')
    app.emit(app.mock.session(meta), 'test/bar' as any)
    app.emit(app.mock.session(meta), 'test/baz' as any)
    expect(bar.mock.calls).to.have.length(0)
    expect(baz.mock.calls).to.have.length(1)

    meta = app.mock.client('321', '456').meta
    app.emit(app.mock.session(meta), 'test/bar' as any)
    app.emit(app.mock.session(meta), 'test/baz' as any)
    expect(bar.mock.calls).to.have.length(0)
    expect(baz.mock.calls).to.have.length(1)
  })
})
