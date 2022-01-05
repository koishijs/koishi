import { App, Assets, Context, Logger, Time } from 'koishi'
import createEnvironment from './environment'
import { install } from '@sinonjs/fake-timers'
import * as teach from '@koishijs/plugin-teach'
import jest from 'jest-mock'

const DETAIL_HEAD = '编号为 1 的问答信息：\n问题：foo\n回答：bar\n'
const SEARCH_HEAD = '问题“foo”的回答如下：\n'

describe('Teach Plugin - Miscellaneous', () => {
  describe('Time', () => {
    const { u3g1 } = createEnvironment({ useTime: true })

    it('time', async () => {
      await u3g1.shouldReply('# bar foo -t baz', '选项 startTime 输入无效，请输入正确的时间。')
      await u3g1.shouldReply('# foo bar -t 8 -T 16', '问答已添加，编号为 1。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '触发时段：8:00-16:00')
      await u3g1.shouldReply('## foo', SEARCH_HEAD + '1. [8:00-16:00] bar')
      await u3g1.shouldReply('## foo -t 12', SEARCH_HEAD + '1. [8:00-16:00] bar')
      await u3g1.shouldReply('## foo -T 12', '没有搜索到问题“foo”，请尝试使用正则表达式匹配。')
    })

    it('receiver', async () => {
      const clock = install({
        now: new Date('2020-1-1 12:00'),
        shouldAdvanceTime: true,
        advanceTimeDelta: 5,
      })

      await u3g1.shouldReply('foo', 'bar')
      clock.tick(8 * Time.hour) // 20:00
      await u3g1.shouldNotReply('foo')
      clock.tick(8 * Time.hour) // 4:00
      await u3g1.shouldNotReply('foo')
      clock.tick(8 * Time.hour) // 12:00
      await u3g1.shouldReply('foo', 'bar')

      clock.uninstall()
    })
  })

  describe('Assets', () => {
    const logger = new Logger('teach')
    const { app, u3g1 } = createEnvironment({})
    const upload = jest.fn(async (url: string) => url)

    app.plugin(class MockAssets extends Assets {
      types = ['image']
      upload = upload
      stats = async () => ({})
    })

    it('upload succeed', async () => {
      upload.mockResolvedValue('https://127.0.0.1/image/baz')
      await u3g1.shouldReply('# foo [CQ:image,file=baz,url=bar]', '问答已添加，编号为 1。')
      await u3g1.shouldReply('foo', '[CQ:image,url=https://127.0.0.1/image/baz]')
    })

    it('upload failed', async () => {
      logger.level = Logger.ERROR
      upload.mockRejectedValue('failed')
      await u3g1.shouldReply('#1 fooo', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1 ~ [CQ:image,file=bar,url=baz]', '上传图片时发生错误。')
      logger.level = Logger.WARN
    })
  })

  describe('Rate Limit', () => {
    // make coverage happy
    new App().plugin(teach, { throttle: [] })
    new App().plugin(teach, { preventLoop: [] })
    new App().plugin(teach, { preventLoop: 10 })

    it('throttle', async () => {
      const { u2g1, u3g1, u4g1, u4g2, start, stop } = createEnvironment({
        throttle: { interval: 1000, responses: 2 },
      })

      await start()
      await u3g1.shouldReply('# baz bar', '问答已添加，编号为 1。')
      await u3g1.shouldReply('# foo => baz', '问答已添加，编号为 2。')
      await u2g1.shouldReply('foo', 'bar')
      await u3g1.shouldReply('foo', 'bar')
      await u4g1.shouldNotReply('foo')
      await u4g2.shouldReply('foo', 'bar')
      await stop()
    })

    it('preventLoop', async () => {
      const { u2g1, u3g1, u4g1, start, stop } = createEnvironment({
        preventLoop: { length: 5, participants: 2 },
      })

      await start()
      await u3g1.shouldReply('# baz bar', '问答已添加，编号为 1。')
      await u3g1.shouldReply('# foo => baz', '问答已添加，编号为 2。')
      await u2g1.shouldReply('foo', 'bar')
      await u2g1.shouldReply('foo', 'bar')
      await u3g1.shouldReply('foo', 'bar')
      await u3g1.shouldReply('foo', 'bar')
      await u2g1.shouldReply('foo', 'bar')
      await u2g1.shouldNotReply('foo')
      await u3g1.shouldNotReply('foo')
      await u4g1.shouldReply('foo', 'bar')
      await stop()
    })
  })
})
