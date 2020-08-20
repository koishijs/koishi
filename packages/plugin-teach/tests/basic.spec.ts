import { App } from 'koishi-test-utils'
import * as teach from '../src'
import * as utils from './utils'
import { expect } from 'chai'

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

after(async () => {
  await app.stop()
})

describe('koishi-plugin-teach', () => {
  it('create', async () => {
    await session1.shouldHaveNoReply('foo')
    await session1.shouldHaveReply('# foo', '缺少问题或回答，请检查指令语法。')
    await session1.shouldHaveReply('# foo bar', '问答已添加，编号为 1。')
    await session1.shouldHaveReply('# foo bar baz', '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    await session1.shouldHaveReply('foo', 'bar')
  })

  it('modify', async () => {
    await session1.shouldHaveReply('# foo bar', '问答已存在，编号为 1，如要修改请尝试使用 #1 指令。')
    await session1.shouldHaveReply('# foo bar -P 1', '修改了已存在的问答，编号为 1。')
    await session1.shouldHaveReply('#1 -P 1', '问答 1 没有发生改动。')
    await session1.shouldHaveReply('#1 ~ baz', '问答 1 已成功修改。')
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
