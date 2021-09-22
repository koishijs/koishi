import { install, InstalledClock } from '@sinonjs/fake-timers'
import { expect } from 'chai'
import { Logger } from 'koishi'
import { Writable } from 'stream'

describe('Logger API', () => {
  let logger: Logger
  let data: string
  let clock: InstalledClock
  const { colors } = Logger.options

  before(() => {
    Logger.showDiff = true
    Logger.options.colors = false
    clock = install({ now: Date.now() })
  })

  after(() => {
    Logger.showDiff = false
    Logger.options.colors = colors
    clock.uninstall()
  })

  beforeEach(() => {
    data = ''
  })

  it('basic support', () => {
    logger = new Logger('test').extend('logger')
    expect(logger.name).to.equal('test:logger')
    expect(logger).to.equal(new Logger('test:logger'))
    Logger.print = (text) => {
      data += text + '\n'
    }
  })

  it('format error', () => {
    const error = new Error('message')
    error.stack = null
    logger.error(error)
    expect(data).to.equal('[E] test:logger message +0ms\n')
  })

  it('format object', () => {
    clock.tick(2)
    const object = { foo: 'bar' }
    logger.success(object)
    expect(data).to.equal("[S] test:logger { foo: 'bar' } +2ms\n")
  })

  it('custom formatter', () => {
    clock.tick(1)
    Logger.formatters.x = () => 'custom'
    logger.info('%x%%x')
    expect(data).to.equal('[I] test:logger custom%x +1ms\n')
  })

  it('log levels', () => {
    logger.debug('%c', 'foo bar')
    expect(data).to.equal('')

    logger.level = Logger.SILENT
    logger.debug('%c', 'foo bar')
    expect(data).to.equal('')

    logger.level = Logger.DEBUG
    logger.debug('%c', 'foo bar')
    expect(data).to.be.ok
  })
})
