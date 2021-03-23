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
  async getDialoguesById(ids, fields) {
    if (!ids.length) return []
    let cursor = this.db.collection('dialogue').find({ _id: { $in: ids } })
    if (fields) cursor = cursor.project(Object.fromEntries(fields.map(k => [k, 1])))
    const dialogues = await cursor.toArray()
    dialogues.forEach(d => {
      d._id = d.id
      defineProperty(d, '_backup', clone(d))
    })
    return dialogues
  },

  async getDialoguesByTest(test: DialogueTest) {
    const query: FilterQuery<Dialogue> = { $and: [] }
    this.app.emit('dialogue/mongo', test, query.$and)
    const dialogues = await this.db.collection('dialogue').find(query).toArray()
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues.filter(value => {
      if (value.flag & Dialogue.Flag.regexp) {
        const regex = new RegExp(value.question, 'i')
        if (!(regex.test(test.question) || regex.test(test.original))) return false
      }
      if (test.groups && !test.partial) {
        return !(value.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.groups, value.groups)
      }
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

  async recoverDialogues(dialogues: Dialogue[], argv: Dialogue.Argv) {
    if (!dialogues.length) return
    const tasks = []
    for (const dialogue of dialogues) {
      tasks.push(await this.db.collection('dialogue').updateOne({ _id: dialogue.id }, { $set: dialogue }))
    }
    await Promise.all(tasks)
    for (const dialogue of dialogues) {
      Dialogue.addHistory(dialogue, '修改', argv, true)
    }
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
  ctx.on('dialogue/flag', (flag) => {
    ctx.on('dialogue/mongo', (test, conditionals) => {
      if (test[flag] === undefined) return
      conditionals.push({
        flag: { [test[flag] ? '$bitsAllSet' : '$bitsAllClear']: Dialogue.Flag[flag] },
      })
    })
  })

  ctx.on('dialogue/mongo', ({ regexp, answer, question, original }, conditionals) => {
    if (regexp) {
      if (answer) conditionals.push({ answer: { $regex: new RegExp(answer, 'i') } })
      if (question) conditionals.push({ question: { $regex: new RegExp(original, 'i') } })
      return
    }
    if (answer) conditionals.push({ answer })
    if (question) {
      if (regexp === false) {
        conditionals.push({ question })
      } else {
        const $expr = {
          body(field: string, question: string, original: string) {
            const regex = new RegExp(field, 'i')
            return regex.test(question) || regex.test(original)
          },
          args: ['$name', question, original],
          lang: 'js',
        }
        conditionals.push({
          $or: [
            { flag: { $bitsAllClear: Dialogue.Flag.regexp }, question },
            { flag: { $bitsAllSet: Dialogue.Flag.regexp }, $expr },
          ],
        })
      }
    }
  })

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

  ctx.on('dialogue/mongo', ({ predecessors, stateful, noRecursive }, conditionals) => {
    if (noRecursive) {
      conditionals.push({ predecessors: { $size: 0 } })
    } else if (predecessors !== undefined) {
      if (stateful) {
        conditionals.push({
          $or: [
            { predecessors: { $size: 0 } },
            { predecessors: { $in: predecessors.map(i => i.toString()) } },
          ],
        })
      } else if (predecessors.length) {
        conditionals.push({ predecessors: { $in: predecessors.map(i => i.toString()) } })
      }
    }
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
