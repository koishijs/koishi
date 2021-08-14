import { Database, Context } from 'koishi-core'
import { defineProperty, Observed, clone } from 'koishi-utils'
import { Dialogue, DialogueTest, equal, apply } from 'koishi-plugin-teach'
import { App } from 'koishi-test-utils'

declare module 'koishi-core' {
  interface EventMap {
    'dialogue/memory'(dialogue: Dialogue, test: DialogueTest): boolean | void
  }
}

Database.extend('koishi-test-utils', {
  async getDialoguesByTest(test: DialogueTest) {
    const dialogues = this.$table('dialogue').filter((dialogue) => {
      return !this.app.bail('dialogue/memory', dialogue, test)
    }).map<Dialogue>(clone)
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues.filter((data) => {
      if (!test.groups || test.partial) return true
      return !(data.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.groups, data.groups)
    })
  },

  async updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const data: Partial<Dialogue>[] = []
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        data.push({ id: dialogue.id, ...dialogue._diff })
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        Dialogue.addHistory(dialogue._backup, '修改', argv, false)
      }
    }
    await this.update('dialogue', data)
  },

  async getDialogueStats() {
    const dialogues = this.$count('dialogue')
    const questions = this.$count('dialogue', 'question')
    return { questions, dialogues }
  },
})

export function memory(ctx: Context) {
  ctx.database.memory.$store.dialogue = []

  // time
  ctx.on('dialogue/memory', (data, { matchTime, mismatchTime }) => {
    if (matchTime !== undefined && getProduct(data, matchTime) < 0) return true
    if (mismatchTime !== undefined && getProduct(data, mismatchTime) >= 0) return true
  })

  // context
  ctx.on('dialogue/memory', (data, test) => {
    if (!test.groups || !test.groups.length) return
    if (!(data.flag & Dialogue.Flag.complement) === test.reversed) {
      return test.groups.some(id => data.groups.includes(id))
    } else {
      return test.groups.some(id => !data.groups.includes(id))
    }
  })
}

function getProduct({ startTime, endTime }: Dialogue, time: number) {
  return (startTime - time) * (time - endTime) * (endTime - startTime)
}

export default function (config: Dialogue.Config) {
  const app = new App({
    nickname: ['koishi', 'satori'],
    mockDatabase: true,
  })

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

  app.plugin(apply, {
    historyAge: 0,
    useContext: false,
    useTime: false,
    useWriter: false,
    successorTimeout: 0,
    ...config,
  })

  app.plugin(memory)

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
