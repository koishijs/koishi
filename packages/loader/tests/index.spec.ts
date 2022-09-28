import { expect } from 'chai'
import { Context } from 'koishi'
import Loader from './utils'

it('1', async () => {
  const loader = new Loader()
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
  expect(app.options.prefix).to.deep.equal(['.'])
  expect(app.registry.get(loader.data.foo)).to.be.ok
  expect(app.registry.get(loader.data.foo)?.config).to.deep.equal({})
  expect(app.registry.get(loader.data.bar)).to.be.ok
  expect(app.registry.get(loader.data.bar)?.config).to.deep.equal({ a: 1 })

  app.state.update({
    prefix: '/',
    plugins: {
      'group:qux': {
        'baz': {},
        'bar': {
          a: 2,
        },
      },
    },
  })
  await app.lifecycle.flush()
  expect(app.options.prefix).to.deep.equal(['/'])
  expect(app.registry.get(loader.data.foo)).to.be.not.ok
  expect(app.registry.get(loader.data.bar)).to.be.ok
  expect(app.registry.get(loader.data.bar)?.config).to.deep.equal({ a: 2 })
  expect(app.registry.get(loader.data.baz)).to.be.ok
  expect(app.registry.get(loader.data.baz)?.config).to.deep.equal({})
})
