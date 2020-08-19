import { App } from 'koishi-test-utils'
import * as teach from '../src'
import * as utils from './utils'
import { expect } from 'chai'

const app = new App()
const session = app.createSession('group', 123, 456)

app.plugin(teach, {
  historyAge: 0,
})

app.plugin(utils)

before(async () => {
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getGroup(456, app.selfId)
})

after(async () => {
  await app.stop()
})

describe('teach', () => {
  it('create', async () => {
    await session.shouldHaveNoReply('foo')
    await session.shouldHaveReply('# foo', '缺少问题或回答，请检查指令语法。')
    await session.shouldHaveReply('# foo bar', '问答已添加，编号为 1。')
    await session.shouldHaveReply('# foo bar baz', '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    await session.shouldHaveReply('foo', 'bar')
  })

  it('modify', async () => {
    await session.shouldHaveReply('# foo bar', '问答已存在，编号为 1，如要修改请尝试使用 #1 指令。')
    await session.shouldHaveReply('# foo bar -P 1', '修改了已存在的问答，编号为 1。')
    await session.shouldHaveReply('#1 -P 1', '问答 1 没有发生改动。')
    await session.shouldHaveReply('#1 ~ baz', '问答 1 已成功修改。')
    await session.shouldHaveReply('foo', 'baz')
  })

  it('search', async () => {
    await session.shouldHaveReply('## foo', '问题“foo”的回答如下：\n1. [P=1] baz')
    await session.shouldHaveReply('## baz', '没有搜索到问题“baz”，请尝试使用正则表达式匹配。')
    await session.shouldHaveReply('## ~ baz', '回答“baz”的问题如下：\n1. [P=1] foo')
    await session.shouldHaveReply('## ~ foo', '没有搜索到回答“foo”，请尝试使用正则表达式匹配。')
  })
})
