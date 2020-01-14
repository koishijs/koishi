import { MockedApp } from 'koishi-test-utils'
import { resolve } from 'path'
import { help } from 'koishi-plugin-common'
import 'koishi-database-level'
import * as teach from '../src'
import del from 'del'

const path = resolve(__dirname, '../temp')

const app = new MockedApp({ database: { level: { path } } })
const session = app.createSession('group', 123, 456)

app.plugin(teach)
app.plugin(help)

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getGroup(456, app.selfId)
})

afterAll(async () => {
  await app.stop()
  await del(path)
})

test('basic support', async () => {
  await session.shouldHaveNoResponse('foo')
  await session.shouldHaveReply('teach foo bar', '问答已添加，编号为 1。')
  await session.shouldHaveReply('foo', 'bar')
})

test('check options', async () => {
  await session.shouldHaveReply('teach -c 50', '参数 -c, --chance 应为不超过 1 的正数。')
  await session.shouldHaveReply('teach -q [CQ:image,file=0.png]', '问题不能包含图片。')
})

test('show info', async () => {
  await session.shouldHaveReply('teach foo baz', '问答已添加，编号为 2。')
  await session.shouldHaveReply('teach -i', '共收录了 1 个问题和 2 个回答。')
})

test('search all', async () => {
  await session.shouldHaveReply('teach --all', '全部问答如下：\n1. 问题：“foo”，回答：“bar”\n2. 问题：“foo”，回答：“baz”')
})

test('search question', async () => {
  await session.shouldHaveReply('teach -q bar', '没有搜索到问题“bar”，请尝试使用关键词匹配。')
  await session.shouldHaveReply('teach -q foo', '问题“foo”的回答如下：\n1. bar\n2. baz')
})

test('search answer', async () => {
  await session.shouldHaveReply('teach -a foo', '没有搜索到回答“foo”，请尝试使用关键词匹配。')
  await session.shouldHaveReply('teach -a bar', '回答“bar”的问题如下：\n1. foo')
})

test('search question and answer', async () => {
  await session.shouldHaveReply('teach -q foo -a foo', '没有搜索到问答“foo”“foo”，请尝试使用关键词匹配。')
  await session.shouldHaveReply('teach -q foo -a baz', '问答“foo”“baz”的编号为 2。')
})

test('search question by keyword', async () => {
  await session.shouldHaveReply('teach -kq b', '没有搜索到含有关键词“b”的问题。')
  await session.shouldHaveReply('teach -kq f', '问题关键词“f”的搜索结果如下：\n1. 问题：“foo”，回答：“bar”\n2. 问题：“foo”，回答：“baz”')
})

test('search answer by keyword', async () => {
  await session.shouldHaveReply('teach -ka f', '没有搜索到含有关键词“f”的回答。')
  await session.shouldHaveReply('teach -ka b', '回答关键词“b”的搜索结果如下：\n1. 问题：“foo”，回答：“bar”\n2. 问题：“foo”，回答：“baz”')
})

test('search question and answer by keyword', async () => {
  await session.shouldHaveReply('teach -kq f -a f', '没有搜索到含有关键词“f”“f”的问答。')
  await session.shouldHaveReply('teach -kq f -a b', '问答关键词“f”“b”的搜索结果如下：\n1. 问题：“foo”，回答：“bar”\n2. 问题：“foo”，回答：“baz”')
})
