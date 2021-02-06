import { App } from 'koishi-test-utils'
import { Random, Time } from 'koishi-utils'
import { fn, spyOn } from 'jest-mock'
import { install, InstalledClock } from '@sinonjs/fake-timers'
import { expect } from 'chai'
import * as teach from 'koishi-plugin-teach'
import * as utils from './utils'
import axios from 'axios'

describe('Teach Plugin', () => {
  describe('Basic Support', () => {
    const app = new App({ prefix: '.', mockDatabase: true })
    const session1 = app.session('123', '456')
    const session2 = app.session('321', '456')

    app.plugin(teach, {
      historyAge: 0,
      mergeThreshold: 1,
    })

    app.plugin(utils)

    before(async () => {
      await app.start()
      await app.database.initUser('123', 3)
      await app.database.initUser('321', 2)
      await app.database.initChannel('456')
    })

    it('create', async () => {
      await session1.shouldNotReply('foo')
      await session1.shouldReply('# foo', '缺少问题或回答，请检查指令语法。')
      await session1.shouldReply('# foo bar', '问答已添加，编号为 1。')
      await session1.shouldReply('# foo bar baz', '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
      await session1.shouldReply('foo', 'bar')
    })

    it('validate', async () => {
      await session1.shouldReply('# [CQ:image] bar', '问题必须是纯文本。')
      await session1.shouldReply('# foo[foo bar -x', '问题含有错误的或不支持的正则表达式语法。')
    })

    it('modify', async () => {
      await session1.shouldReply('# foo bar', '问答已存在，编号为 1，如要修改请尝试使用 #1 指令。')
      await session1.shouldReply('# foo bar -P 1', '修改了已存在的问答，编号为 1。')
      await session1.shouldReply('#1 -P 1', '问答 1 没有发生改动。')
      await session1.shouldReply('#1 baz', '推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -I 选项以忽略本提示。')
      await session1.shouldReply('#1 baz', '推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -I 选项以忽略本提示。')
      await session1.shouldReply('.', '问答 1 已成功修改。')
      await session1.shouldReply('foo', 'baz')
    })

    it('search 1', async () => {
      await session1.shouldReply('## foo', '问题“foo”的回答如下：\n1. [P=1] baz')
      await session1.shouldReply('## baz', '没有搜索到问题“baz”，请尝试使用正则表达式匹配。')
      await session1.shouldReply('## baz -x', '没有搜索到含有正则表达式“baz”的问题。')
      await session1.shouldReply('## ~ baz', '回答“baz”的问题如下：\n1. [P=1] foo')
      await session1.shouldReply('## ~ foo', '没有搜索到回答“foo”，请尝试使用正则表达式匹配。')
      await session1.shouldReply('## ~ foo -x', '没有搜索到含有正则表达式“foo”的回答。')
      await session1.shouldReply('## foo baz', '“foo”“baz”匹配的回答如下：\n1')
      await session1.shouldReply('## foo bar', '没有搜索到问答“foo”“bar”，请尝试使用正则表达式匹配。')
      await session1.shouldReply('## foo bar -x', '没有搜索到含有正则表达式“foo”“bar”的问答。')
    })

    it('search 2', async () => {
      await session1.shouldReply('# foo bar', '问答已添加，编号为 2。')
      await session1.shouldReply('# goo bar', '问答已添加，编号为 3。')
      await session1.shouldReply('##', '共收录了 2 个问题和 3 个回答。')
      await session1.shouldReply('## fo -x', '问题正则表达式“fo”的搜索结果如下：\n1. [P=1] 问题：foo，回答：baz\n2. 问题：foo，回答：bar')
      await session1.shouldReply('## ~ ar -x', '回答正则表达式“ar”的搜索结果如下：\n2. 问题：foo，回答：bar\n3. 问题：goo，回答：bar')
      await session1.shouldReply('## fo ar -x', '问答正则表达式“fo”“ar”的搜索结果如下：\n2. 问题：foo，回答：bar')
      await session1.shouldReply('### oo', '问题正则表达式“oo”的搜索结果如下：\nfoo (共 2 个回答)\ngoo (#3)')
      await session1.shouldReply('### ~ ba', '回答正则表达式“ba”的搜索结果如下：\nbaz (#1)\nbar (共 2 个问题)')
    })

    it('miscellaneous', async () => {
      await session1.shouldNotReply('.foo')
      await session1.shouldReply('#')
      await session2.shouldReply('#')
    })
  })

  function createEnvironment(config: teach.Config) {
    const app = new App({ userCacheAge: Number.EPSILON, nickname: ['koishi', 'satori'], mockDatabase: true })
    const u2id = '200', u3id = '300', u4id = '400'
    const g1id = '100', g2id = '200'
    const u2 = app.session(u2id)
    const u3 = app.session(u3id)
    const u4 = app.session(u4id)
    const u2g1 = app.session(u2id, g1id)
    const u2g2 = app.session(u2id, g2id)
    const u3g1 = app.session(u3id, g1id)
    const u3g2 = app.session(u3id, g2id)
    const u4g1 = app.session(u4id, g1id)
    const u4g2 = app.session(u4id, g2id)

    app.plugin(teach, {
      historyAge: 0,
      useContext: false,
      useTime: false,
      useWriter: false,
      successorTimeout: 0,
      ...config,
    })

    app.plugin(utils)

    async function start() {
      await app.start()
      await app.database.initUser(u2id, 2)
      await app.database.initUser(u3id, 3)
      await app.database.initUser(u4id, 4)
      await app.database.initChannel(g1id)
      await app.database.initChannel(g2id)
    }

    before(start)

    return { app, u2, u3, u4, u2g1, u2g2, u3g1, u3g2, u4g1, u4g2, start }
  }

  const DETAIL_HEAD = '编号为 1 的问答信息：\n问题：foo\n回答：bar\n'
  const SEARCH_HEAD = '问题“foo”的回答如下：\n'

  describe('Internal', () => {
    const { u3g1 } = createEnvironment({})

    let clock: InstalledClock
    const randomReal = spyOn(Random, 'real')

    before(() => {
      clock = install({ shouldAdvanceTime: true, advanceTimeDelta: 5 })
      randomReal.mockReturnValue(1 - Number.EPSILON)
    })

    after(() => {
      clock.uninstall()
      randomReal.mockRestore()
    })

    it('appellative', async () => {
      await u3g1.shouldReply('# koishi,foo bar', '问答已添加，编号为 1。')
      await u3g1.shouldNotReply('foo')
      await u3g1.shouldReply('koishi, foo', 'bar')
      await u3g1.shouldReply('satori, foo', 'bar')
      // TODO support at-trigger
      // await u3g1.shouldReply(`[CQ:at,qq=${app.selfId}] foo`, 'bar')
      await u3g1.shouldReply('#1', '编号为 1 的问答信息：\n问题：koishi,foo\n回答：bar\n触发权重：p=0, P=1')
      await u3g1.shouldReply('## foo', SEARCH_HEAD + '1. [p=0, P=1] bar')
    })

    it('activated', async () => {
      await u3g1.shouldReply('# koishi ?', '问答已添加，编号为 2。')
      await u3g1.shouldReply('koishi', '?')
      await u3g1.shouldReply('foo', 'bar')

      // due to mocked Random.real
      await u3g1.shouldReply('# satori ! -p 0.5', '问答已添加，编号为 3。')
      await u3g1.shouldNotReply('satori')
    })

    it('regular expression', async () => {
      clock.runAll()
      await u3g1.shouldReply('# foo baz -xP 0.5', '问答已添加，编号为 4。')
      await u3g1.shouldNotReply('foo')
      await u3g1.shouldReply('koishi, fooo', 'baz')
      await u3g1.shouldReply('#4 -p 0.5 -P 1', '问答 4 已成功修改。')
      await u3g1.shouldReply('koishi, fooo', 'baz')
    })
  })

  describe('Context', () => {
    const { u3, u3g1, u3g2 } = createEnvironment({ useContext: true })

    it('validate options 1', async () => {
      await u3.shouldReply('# foo bar', '非群聊上下文中请使用 -E/-D 进行操作或指定 -g, --groups 选项。')
      await u3.shouldReply('# foo bar -g 100', '选项 -g, --groups 必须与 -d/-D/-e/-E 之一同时使用。')
      await u3.shouldReply('# foo bar -eg 100', '问答已添加，编号为 1。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：本群')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
    })

    it('validate options 2', async () => {
      await u3g1.shouldReply('#1 -de', '选项 -d, -e 不能同时使用。')
      await u3g1.shouldReply('#1 -DE', '选项 -D, -E 不能同时使用。')
      await u3g1.shouldReply('#1 -Dd', '选项 -D, -d 不能同时使用。')
      await u3g1.shouldReply('#1 -Ee', '选项 -E, -e 不能同时使用。')
    })

    it('limited group enabled (with current group)', async () => {
      await u3g2.shouldReply('# foo bar', '修改了已存在的问答，编号为 1。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：本群等 2 个群')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
    })

    it('limited group enabled (without current group)', async () => {
      await u3g1.shouldReply('#1 -d', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：1 个群')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [D] bar')
    })

    it('limited group enabled (with no groups)', async () => {
      await u3g1.shouldReply('#1 -D', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：全局禁止')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [D] bar')
    })

    it('unlimited group enabled (with all groups)', async () => {
      await u3g1.shouldReply('#1 -E', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：全局')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [E] bar')
    })

    it('unlimited group enabled (with current group)', async () => {
      await u3g1.shouldReply('#1 -dg 200', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：除 1 个群外的所有群')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [E] bar')
    })

    it('unlimited group enabled (without current group)', async () => {
      await u3g1.shouldReply('#1 -d', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：除本群等 2 个群外的所有群')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [d] bar')
    })

    it('limited group enabled (with current group only)', async () => {
      await u3g1.shouldReply('#1 -De', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：本群')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
    })

    it('unlimited group enabled (without current group only)', async () => {
      await u3g1.shouldReply('#1 -Ed', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '生效环境：除本群')
      await u3g1.shouldReply('## foo -G', SEARCH_HEAD + '1. [d] bar')
    })
  })

  describe('Writer', () => {
    const { app, u2, u3g1, u4g2 } = createEnvironment({ useWriter: true })

    app.command('test').action(({ session }) => '' + session.userId)

    it('create writer', async () => {
      // 当自身未设置 username 时使用 session.sender
      u3g1.meta.author.username = 'nick3'
      await u3g1.shouldReply('# foo bar', '问答已添加，编号为 1。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '来源：nick3 (300)')

      // 重复添加问答时不应该覆盖旧的作者
      await app.database.setUser('mock', '300', { name: 'user3' })
      await u4g2.shouldReply('# foo bar', '问答已存在，编号为 1，如要修改请尝试使用 #1 指令。')
      await u4g2.shouldReply('#1', DETAIL_HEAD + '来源：user3 (300)')
    })

    it('modify writer', async () => {
      await u2.shouldReply('#1 -W', '问答 1 因权限过低无法修改。')
      await u4g2.shouldReply('#1 -w foo', '选项 writer 输入无效，请检查语法。')
      await u4g2.shouldReply('#1 -w [CQ:at,qq=500]', '指定的目标用户不存在。')
      await u4g2.shouldReply('#1 -w [CQ:at,qq=200]', '问答 1 已成功修改。')

      // 实在找不到名字就只显示未知用户
      await u4g2.shouldReply('#1', DETAIL_HEAD + '来源：未知用户')
      const getGroupMemberMap = app.bots[0].getGroupMemberMap = fn()
      getGroupMemberMap.mockReturnValue(Promise.resolve({ 200: 'mock2' }))
      await u4g2.shouldReply('#1', DETAIL_HEAD + '来源：mock2')
      getGroupMemberMap.mockRestore()
    })

    it('anonymous', async () => {
      u2.meta.author.username = 'nick2'
      await u2.shouldReply('#1', DETAIL_HEAD + '来源：nick2 (200)')
      await u2.shouldReply('#1 -W', '问答 1 已成功修改。')
      await u2.shouldReply('#1', DETAIL_HEAD.slice(0, -1))
      await u2.shouldReply('#1 -p 0', '问答 1 因权限过低无法修改。')
    })

    it('frozen', async () => {
      await u3g1.shouldReply('# foo baz -f', '权限不足。')
      await u4g2.shouldReply('# foo bar -f', '修改了已存在的问答，编号为 1。')
      await u3g1.shouldReply('# foo bar -p 0', '问答 1 因权限过低无法修改。')
      await u3g1.shouldReply('#1', DETAIL_HEAD + '此问答已锁定。')
      await u3g1.shouldReply('## foo', SEARCH_HEAD + '1. [锁定] bar')
      await u4g2.shouldReply('#1 -F', '问答 1 已成功修改。')
    })
  })

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

  describe('Image (Client)', () => {
    const axiosGet = spyOn(axios, 'get')
    const uploadKey = Random.uuid()
    const imageServer = 'https://127.0.0.1/image'
    const uploadServer = 'https://127.0.0.1/upload'
    const { u3g1 } = createEnvironment({ uploadKey, uploadServer, imageServer })

    it('upload succeed', async () => {
      axiosGet.mockReturnValue(Promise.resolve())
      await u3g1.shouldReply('# foo [CQ:image,file=baz,url=bar]', '问答已添加，编号为 1。')
      await u3g1.shouldReply('foo', '[CQ:image,file=https://127.0.0.1/image/baz]')
      expect(axiosGet.mock.calls).to.have.shape([[uploadServer, {
        params: { file: 'baz', url: 'bar' },
      }]])
    })

    it('upload failed', async () => {
      axiosGet.mockReturnValue(Promise.reject(new Error('failed')))
      await u3g1.shouldReply('#1 fooo', '问答 1 已成功修改。')
      await u3g1.shouldReply('#1 ~ [CQ:image,file=bar,url=baz]', '上传图片时发生错误。')
    })

    it('get status', async () => {
      axiosGet.mockReturnValue(Promise.resolve({
        data: { totalSize: 10000000, totalCount: 10 },
      }))
      await u3g1.shouldReply('##', '共收录了 1 个问题和 1 个回答。\n收录图片 10 张，总体积 9.5 MB。')
    })
  })

  describe('Rate Limit', () => {
    // make coverage happy
    new App().plugin(teach, { throttle: [] })
    new App().plugin(teach, { preventLoop: [] })
    new App().plugin(teach, { preventLoop: 10 })

    it('throttle', async () => {
      const { u2g1, u3g1, u4g1, u4g2, start } = createEnvironment({
        throttle: { interval: 1000, responses: 2 },
      })

      await start()
      await u3g1.shouldReply('# baz bar', '问答已添加，编号为 1。')
      await u3g1.shouldReply('# foo => baz', '问答已添加，编号为 2。')
      await u2g1.shouldReply('foo', 'bar')
      await u3g1.shouldReply('foo', 'bar')
      await u4g1.shouldNotReply('foo')
      await u4g2.shouldReply('foo', 'bar')
    })

    it('preventLoop', async () => {
      const { u2g1, u3g1, u4g1, start } = createEnvironment({
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
    })
  })
})
