import { App } from 'koishi-test-utils'
import { resolve } from 'path'
import * as nlp from '../src'

test('basic support', async () => {
  const app = new App()
  const session = app.createSession('user', 123)
  app.plugin(nlp)

  app.command('weather <location>')
    .intend('天气', (meta) => {
      const tag = meta.$parsed.tags.find(({ tag }) => tag === 'ns')
      if (tag) return { args: [tag.word] }
    })
    .action(({ meta }, location) => meta.$send(location))

  await session.shouldHaveNoReply('今天的天气')
  await session.shouldHaveNoReply('今天的北京')
  await session.shouldHaveNoReply('幻想乡今天的天气')
  await session.shouldHaveReply('北京今天的天气', '北京')
})

test('user dict', async () => {
  const app = new App()
  const session = app.createSession('user', 123)
  app.plugin(nlp, {
    userDict: resolve(__dirname, 'user.dict.utf8'),
  })

  app.command('weather <location>')
    .intend(['天气'], (meta) => {
      const tag = meta.$parsed.tags.find(({ tag }) => tag === 'ns')
      if (tag) return { confidence: 0.9, args: [tag.word] }
      return { confidence: 0.5 }
    })
    .action(({ meta }, location) => meta.$send(location))

  await session.shouldHaveNoReply('今天的天气')
  await session.shouldHaveNoReply('今天的北京')
  await session.shouldHaveReply('北京今天的天气', '北京')
  await session.shouldHaveReply('幻想乡今天的天气', '幻想乡')
})
