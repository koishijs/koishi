import { App, BASE_SELF_ID } from 'koishi-test-utils'
import { App as RealApp } from 'koishi-core'
import { Random } from 'koishi-utils'
import { expect } from 'chai'
import { spyOn } from 'jest-mock'
import getPort from 'get-port'

describe('Server API', () => {
  it('type check', () => {
    expect(() => new RealApp({ type: 'foo' })).to.throw('unsupported type "foo", you should import the adapter yourself')
  })

  it('http server', async () => {
    const port = await getPort({ port: Random.int(16384, 49152) })
    const app = new App({ port })
    await app.start()
    await app.stop()
  })

  it('ctx.bots', async () => {
    const app = new App()
    expect(app.bots[0]).to.equal(app.bots[BASE_SELF_ID])
  })

  it('app.getSelfIds 1', async () => {
    const app = new App()
    await expect(app.getSelfIds()).eventually.to.deep.equal([BASE_SELF_ID])
  })

  it('app.getSelfIds 2', async () => {
    const app = new App()
    delete app.bots[0].selfId
    const getSelfId = spyOn(app.bots[0], 'getSelfId')
    getSelfId.mockReturnValue(Promise.resolve(BASE_SELF_ID))
    await expect(app.getSelfIds()).eventually.to.deep.equal([BASE_SELF_ID])
  })
})
