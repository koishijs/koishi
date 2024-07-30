import { expect } from 'chai'
import { Context, sleep } from 'koishi'
import { Mock } from 'node:test'
import mock from '@koishijs/plugin-mock'
import Loader from './utils'

describe('@koishijs/loader', () => {
  const loader = new Loader()
  loader.writable = true

  it('loader.createApp()', async () => {
    loader.config = {
      prefix: ['.'],
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
    expect(app.koishi.config.prefix).to.deep.equal(['.'])
    expect(app.registry.get(loader.data.foo)).to.be.ok
    expect(app.registry.get(loader.data.foo)?.config).to.deep.equal({})
    expect(app.registry.get(loader.data.bar)).to.be.ok
    expect(app.registry.get(loader.data.bar)?.config).to.deep.equal({ a: 1 })
  })

  it('app.scope.update()', async () => {
    const { app } = loader
    loader.config = {
      prefix: ['/'],
      plugins: {
        'foo': {
          '$if': false,
        },
        'group:qux': {
          '$filter': {
            $eq: [{ $: 'userId' }, '123'],
          },
          'baz': {},
          'bar': {
            'a': 2,
            '$filter': {
              $eq: [{ $: 'channelId' }, '789'],
            },
          },
        },
      },
    }
    app.scope.update(loader.config)
    await sleep(0)
    expect(app.koishi.config.prefix).to.deep.equal(['/'])
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
          $eq: [{ $: 'userId' }, '123'],
        },
        'baz': {},
        'bar': {
          'a': 3,
          '$filter': {
            $eq: [{ $: 'channelId' }, '789'],
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
    const bar = app.lifecycle._hooks['test/bar'][0].callback as Mock<() => void>
    const baz = app.lifecycle._hooks['test/baz'][0].callback as Mock<() => void>
    expect(bar.mock.calls).to.have.length(0)
    expect(baz.mock.calls).to.have.length(0)

    let { event } = app.mock.client('123', '456')
    app.emit(app.mock.session(event), 'test/bar' as any)
    app.emit(app.mock.session(event), 'test/baz' as any)
    expect(bar.mock.calls).to.have.length(0)
    expect(baz.mock.calls).to.have.length(1)

    event = app.mock.client('321', '456').event
    app.emit(app.mock.session(event), 'test/bar' as any)
    app.emit(app.mock.session(event), 'test/baz' as any)
    expect(bar.mock.calls).to.have.length(0)
    expect(baz.mock.calls).to.have.length(1)
  })
})
