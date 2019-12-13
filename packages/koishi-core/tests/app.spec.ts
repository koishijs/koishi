import { App, onStart, onStop, startAll, stopAll } from '../src'

const app1 = new App()
const app2 = new App()

describe('lifecycle', () => {
  const mock1 = jest.fn()
  const mock2 = jest.fn()
  onStart(mock1)
  onStop(mock2)

  test('onStart', async () => {
    await startAll()
    expect(mock1).toBeCalledTimes(1)
    expect(mock1).toBeCalledWith(app1, app2)
  })

  test('onStop', () => {
    stopAll()
    expect(mock2).toBeCalledTimes(1)
  })
})
