import { Random } from 'koishi-utils'
import { install, InstalledClock } from '@sinonjs/fake-timers'
import createEnvironment from './environment'
import jest from 'jest-mock'

describe('Teach Plugin - Basic', () => {
  describe('Basic Support', () => {
    const { app } = createEnvironment({
      mergeThreshold: 1,
    })

    const session1 = app.session('123', '456')
    const session2 = app.session('321', '456')

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

  describe('Internal', () => {
    const { u3g1 } = createEnvironment({})

    let clock: InstalledClock
    const randomReal = jest.spyOn(Random, 'real')

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
      // await u3g1.shouldReply(`[CQ:at,id=${app.selfId}] foo`, 'bar')
      await u3g1.shouldReply('#1', '编号为 1 的问答信息：\n问题：koishi,foo\n回答：bar\n触发权重：p=0, P=1')
      await u3g1.shouldReply('## foo', '问题“foo”的回答如下：\n1. [p=0, P=1] bar')
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
})
