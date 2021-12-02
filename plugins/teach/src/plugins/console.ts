import { Context } from 'koishi'
import { resolve } from 'path'
import { Dialogue } from '../utils'
import {} from '@koishijs/plugin-console'
import {} from '@koishijs/plugin-status'

declare module '@koishijs/plugin-status' {
  namespace MetaProvider {
    interface Payload extends Dialogue.Stats {}
  }

  namespace StatisticsProvider {
    interface Payload {
      questions: QuestionData[]
    }
  }
}

interface QuestionData {
  name: string
  value: number
}

export default class TeachConsole {
  static using = ['console'] as const

  constructor(ctx: Context, config: Dialogue.Config = {}) {
    const filename = ctx.console.config.devMode ? '../../client/index.ts' : '../../dist/index.js'
    ctx.console.addEntry(resolve(__dirname, filename))

    ctx.with(['console/meta'], (ctx) => {
      ctx.console.services.meta.extend(() => ctx.teach.stats())
    })

    ctx.with(['console/stats'], (ctx) => {
      const { stats } = ctx.console.services

      ctx.on('dialogue/before-send', ({ session, dialogue }) => {
        session._sendType = 'dialogue'
        stats.sync.addDaily('dialogue', dialogue.id)
        stats.upload()
      })

      stats.extend(async (payload, data) => {
        const dialogueMap = stats.average(data.daily.map(data => data.dialogue))
        const dialogues = await ctx.database.get('dialogue', Object.keys(dialogueMap).map(i => +i), ['id', 'original'])
        const questionMap: Record<string, QuestionData> = {}
        for (const dialogue of dialogues) {
          const { id, original: name } = dialogue
          if (name.includes('[CQ:') || name.startsWith('hook:')) continue
          if (!questionMap[name]) {
            questionMap[name] = {
              name,
              value: dialogueMap[id],
            }
          } else {
            questionMap[name].value += dialogueMap[id]
          }
        }
        payload.questions = Object.values(questionMap)
      })
    })
  }
}
