import { App } from 'koishi-test-utils'
import * as teach from 'koishi-plugin-teach'
import * as utils from './utils'
import { expect } from 'chai'

describe('Plugin Teach', () => {
  describe('basic support', () => {
    const app = new App({ prefix: '.' })
    const session1 = app.createSession('group', 123, 456)
    const session2 = app.createSession('group', 321, 456)

    app.plugin(teach, {
      historyAge: 0,
      mergeThreshold: 1,
    })

    app.plugin(utils)

    before(async () => {
      await app.start()
      await app.database.getUser(123, 3)
      await app.database.getUser(321, 2)
      await app.database.getGroup(456, app.selfId)
    })

    it('create', async () => {
      await session1.shouldHaveNoReply('foo')
      await session1.shouldHaveReply('# foo', '缺少问题或回答，请检查指令语法。')
      await session1.shouldHaveReply('# foo bar', '问答已添加，编号为 1。')
      await session1.shouldHaveReply('# foo bar baz', '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
      await session1.shouldHaveReply('foo', 'bar')
    })

    it('validate', async () => {
      await session1.shouldHaveReply('# [CQ:image] bar', '问题必须是纯文本。')
      await session1.shouldHaveReply('# foo[foo bar -x', '问题含有错误的或不支持的正则表达式语法。')
    })

    it('modify', async () => {
      await session1.shouldHaveReply('# foo bar', '问答已存在，编号为 1，如要修改请尝试使用 #1 指令。')
      await session1.shouldHaveReply('# foo bar -P 1', '修改了已存在的问答，编号为 1。')
      await session1.shouldHaveReply('#1 -P 1', '问答 1 没有发生改动。')
      await session1.shouldHaveReply('#1 baz', '推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -i 选项以忽略本提示。')
      await session1.shouldHaveReply('#1 baz', '推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -i 选项以忽略本提示。')
      await session1.shouldHaveReply('.', '问答 1 已成功修改。')
      await session1.shouldHaveReply('foo', 'baz')
    })

    it('search 1', async () => {
      await session1.shouldHaveReply('## foo', '问题“foo”的回答如下：\n1. [P=1] baz')
      await session1.shouldHaveReply('## baz', '没有搜索到问题“baz”，请尝试使用正则表达式匹配。')
      await session1.shouldHaveReply('## baz -x', '没有搜索到含有正则表达式“baz”的问题。')
      await session1.shouldHaveReply('## ~ baz', '回答“baz”的问题如下：\n1. [P=1] foo')
      await session1.shouldHaveReply('## ~ foo', '没有搜索到回答“foo”，请尝试使用正则表达式匹配。')
      await session1.shouldHaveReply('## ~ foo -x', '没有搜索到含有正则表达式“foo”的回答。')
      await session1.shouldHaveReply('## foo baz', '“foo”“baz”匹配的回答如下：\n1')
      await session1.shouldHaveReply('## foo bar', '没有搜索到问答“foo”“bar”，请尝试使用正则表达式匹配。')
      await session1.shouldHaveReply('## foo bar -x', '没有搜索到含有正则表达式“foo”“bar”的问答。')
    })

    it('search 2', async () => {
      await session1.shouldHaveReply('# foo bar', '问答已添加，编号为 2。')
      await session1.shouldHaveReply('# goo bar', '问答已添加，编号为 3。')
      await session1.shouldHaveReply('##', '共收录了 2 个问题和 3 个回答。')
      await session1.shouldHaveReply('## fo -x', '问题正则表达式“fo”的搜索结果如下：\n1. [P=1] 问题：foo，回答：baz\n2. 问题：foo，回答：bar')
      await session1.shouldHaveReply('## ~ ar -x', '回答正则表达式“ar”的搜索结果如下：\n2. 问题：foo，回答：bar\n3. 问题：goo，回答：bar')
      await session1.shouldHaveReply('## fo ar -x', '问答正则表达式“fo”“ar”的搜索结果如下：\n2. 问题：foo，回答：bar')
      await session1.shouldHaveReply('### oo', '问题正则表达式“oo”的搜索结果如下：\nfoo (共 2 个回答)\ngoo (#3)')
      await session1.shouldHaveReply('### ~ ba', '回答正则表达式“ba”的搜索结果如下：\nbaz (#1)\nbar (共 2 个问题)')
    })

    it('miscellaneous', async () => {
      await session1.shouldHaveNoReply('.foo')
      await session1.shouldHaveReply('#')
      await session2.shouldHaveReply('#')
    })
  })

  function createEnvironment(config: teach.Config) {
    const app = new App()
    const user = app.createSession('user', 123)
    const group1 = app.createSession('group', 123, 456)
    const group2 = app.createSession('group', 123, 789)

    app.plugin(teach, {
      historyAge: 0,
      useContext: false,
      useTime: false,
      useWriter: false,
      successorTimeout: 0,
      ...config,
    })

    app.plugin(utils)

    before(async () => {
      await app.start()
      await app.database.getUser(123, 3)
      await app.database.getGroup(456, app.selfId)
      await app.database.getGroup(789, app.selfId)
    })

    return { app, user, group1, group2 }
  }

  describe('context', () => {
    const { user, group1, group2 } = createEnvironment({ useContext: true })
    const DETAIL_HEAD = '编号为 1 的问答信息：\n问题：foo\n回答：bar\n'
    const SEARCH_HEAD = '问题“foo”的回答如下：\n'

    it('validate options 1', async () => {
      await user.shouldHaveReply('# foo bar', '非群聊上下文中请使用 -E/-D 进行操作或指定 -g, --groups 选项。')
      await user.shouldHaveReply('# foo bar -g 456', '选项 -g, --groups 必须与 -d/-D/-e/-E 之一同时使用。')
      await user.shouldHaveReply('# foo bar -eg 456', '问答已添加，编号为 1。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：本群')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
    })

    it('validate options 2', async () => {
      await group1.shouldHaveReply('#1 -de', '选项 -d, -e 不能同时使用。')
      await group1.shouldHaveReply('#1 -DE', '选项 -D, -E 不能同时使用。')
      await group1.shouldHaveReply('#1 -Dd', '选项 -D, -d 不能同时使用。')
      await group1.shouldHaveReply('#1 -Ee', '选项 -E, -e 不能同时使用。')
    })

    it('limited group enabled (with current group)', async () => {
      await group2.shouldHaveReply('# foo bar', '修改了已存在的问答，编号为 1。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：本群等 2 个群')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
    })

    it('limited group enabled (without current group)', async () => {
      await group1.shouldHaveReply('#1 -d', '问答 1 已成功修改。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：1 个群')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [D] bar')
    })

    it('limited group enabled (with no groups)', async () => {
      await group1.shouldHaveReply('#1 -D', '问答 1 已成功修改。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：全局禁止')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [D] bar')
    })

    it('unlimited group enabled (with all groups)', async () => {
      await group1.shouldHaveReply('#1 -E', '问答 1 已成功修改。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：全局')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [E] bar')
    })

    it('unlimited group enabled (with current group)', async () => {
      await group1.shouldHaveReply('#1 -dg 789', '问答 1 已成功修改。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：除 1 个群外的所有群')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [E] bar')
    })

    it('unlimited group enabled (without current group)', async () => {
      await group1.shouldHaveReply('#1 -d', '问答 1 已成功修改。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：除本群等 2 个群外的所有群')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [d] bar')
    })

    it('limited group enabled (with current group only)', async () => {
      await group1.shouldHaveReply('#1 -De', '问答 1 已成功修改。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：本群')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [e] bar')
    })

    it('unlimited group enabled (without current group only)', async () => {
      await group1.shouldHaveReply('#1 -Ed', '问答 1 已成功修改。')
      await group1.shouldHaveReply('#1', DETAIL_HEAD + '生效环境：除本群')
      await group1.shouldHaveReply('## foo -G', SEARCH_HEAD + '1. [d] bar')
    })
  })
})
