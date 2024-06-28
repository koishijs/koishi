import { Context } from 'koishi'
import * as inspect from '../src'
import mock from '@koishijs/plugin-mock'

const app = new Context()

app.plugin(inspect)
app.plugin(mock)

const client = app.mock.client('123', '456')

before(() => app.start())
after(() => app.stop())

describe('@koishijs/plugin-inspect', () => {
  it('basic support', async () => {
    await client.shouldReply('inspect', new RegExp([
      '平台名：mock',
      '消息 ID：\\d+',
      '频道 ID：456',
      '群组 ID：456',
      '用户 ID：123',
      '自身 ID：514',
    ].join('\n')))

    await client.shouldReply('inspect <at id="321"/>', '用户 ID：321')
    await client.shouldReply('inspect <sharp id="654"/>', '频道 ID：654')
    await client.shouldReply('inspect foobar', '参数无法解析。')

    await client.shouldReply('<quote id="114514"/> inspect foobar', new RegExp([
      '平台名：mock',
      '消息 ID：114514',
      '频道 ID：.*',
      '群组 ID：456',
      '用户 ID：.*',
      '自身 ID：514',
    ].join('\n')))
  })
})
