import { Context, Database } from 'koishi-core'
import { clone, defineProperty, Observed } from 'koishi-utils'
import type { FilterQuery } from 'mongodb'
import {} from 'koishi-plugin-mongo'
import { Dialogue, DialogueTest, equal } from '../utils'

declare module 'koishi-core' {
  interface EventMap {
    'dialogue/mongo'(test: DialogueTest, conditionals?: FilterQuery<Dialogue>[]): void
  }
}

Database.extend('koishi-plugin-mongo', {
  async getDialoguesByTest(test: DialogueTest) {
    const query: FilterQuery<Dialogue> = { $and: [] }
    this.app.emit('dialogue/mongo', test, query.$and)
    const dialogues = await this.db.collection('dialogue').find(query).toArray()
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues.filter(value => {
      if (test.groups && !test.partial) {
        return !(value.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.groups, value.groups)
      }
      value.id = value._id
      return true
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
    const [data, dialogues] = await Promise.all([
      this.db.collection('dialogue').aggregate([
        { $group: { _id: null, questions: { $addToSet: '$question' } } },
        { $project: { questions: { $size: '$questions' } } },
      ]).toArray(),
      this.db.collection('dialogue').countDocuments(),
    ])
    const { questions } = data[0]
    return { questions, dialogues }
  },
})

export default function apply(ctx: Context) {
  ctx.on('dialogue/mongo', (test, conditionals) => {
    if (!test.groups || !test.groups.length) return
    const $and: FilterQuery<Dialogue>[] = test.groups.map((group) => ({ groups: { $ne: group } }))
    $and.push({ flag: { [test.reversed ? '$bitsAllClear' : '$bitsAllSet']: Dialogue.Flag.complement } })
    conditionals.push({
      $or: [
        {
          flag: { [test.reversed ? '$bitsAllSet' : '$bitsAllClear']: Dialogue.Flag.complement },
          groups: { $all: test.groups },
        },
        { $and },
      ],
    })
  })

  ctx.on('dialogue/mongo', (test, conditionals) => {
    const expr = {
      $multiply: [
        { $subtract: ['$endTime', '$startTime'] },
        { $subtract: ['$startTime', test.matchTime] },
        { $subtract: [test.matchTime, '$endTime'] },
      ],
    }
    if (test.matchTime !== undefined) {
      conditionals.push({ $expr: { $gte: [expr, 0] } })
    }
    if (test.mismatchTime !== undefined) {
      conditionals.push({ $expr: { $lt: [expr, 0] } })
    }
  })

  ctx.on('dialogue/mongo', (test, conditionals) => {
    if (test.writer !== undefined) conditionals.push({ writer: test.writer })
  })
}
