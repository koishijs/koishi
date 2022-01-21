import { App } from 'koishi'
import mock from '@koishijs/plugin-mock'
import * as respondent from '@koishijs/plugin-respondent'

const app = new App()

app.plugin(mock)
app.plugin(respondent, {
  rules: [{
    match: '挖坑一时爽',
    reply: '填坑火葬场',
  }, {
    match: /^(.+)一时爽$/,
    reply: (_, action) => `一直${action}一直爽`,
  }],
})

const client = app.mock.client('123')

before(async () => {
  await app.start()
})

describe('@koishijs/plugin-respondents', () => {
  it('basic support', async () => {
    await client.shouldReply('挖坑一时爽', '填坑火葬场')
    await client.shouldReply('填坑一时爽', '一直填坑一直爽')
    await client.shouldNotReply('填坑一直爽')
  })
})
