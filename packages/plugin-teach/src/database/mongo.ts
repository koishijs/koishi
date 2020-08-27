import { Context, extendDatabase } from 'koishi-core'
import { clone, defineProperty, Observed, pick } from 'koishi-utils'
import { FilterQuery } from 'mongodb'
import MongoDatabase from 'koishi-plugin-mongo/dist/database'
import { Dialogue, DialogueTest, equal } from '../utils'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/mongo'(test: DialogueTest, conditionals?: FilterQuery<Dialogue>[]): void
  }
}

extendDatabase<typeof MongoDatabase>('koishi-plugin-mongo', {
  async getDialoguesById(ids, fields) {
    if (!ids.length) return []
    const p = {}
    for (const field of fields) p[field] = 1
    const dialogues = await this.db.collection('dialogue').find({ _id: { $in: ids } }).project(p).toArray()
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

  async createDialogue(dialogue: Dialogue, argv: Dialogue.Argv, revert = false) {
    if (!dialogue.id) {
      const [latest] = await this.db.collection('dialogue').find().sort('_id', -1).limit(1).toArray()
      if (latest) dialogue.id = latest._id + 1
      else dialogue.id = 1
    }
    await this.db.collection('dialogue').insertOne({ _id: dialogue.id, ...dialogue })
    Dialogue.addHistory(dialogue, '添加', argv, revert)
    return dialogue
  },

  async removeDialogues(ids: number[], argv: Dialogue.Argv, revert = false) {
    if (!ids.length) return
    await this.db.collection('dialogue').deleteMany({ _id: { $in: ids } })
    for (const id of ids) {
      Dialogue.addHistory(argv.dialogueMap[id], '删除', argv, revert)
    }
  },

  async updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const fields = new Set<Dialogue.Field>(['id'])
    for (const { _diff } of dialogues) {
      for (const key in _diff) {
        fields.add(key as Dialogue.Field)
      }
    }
    const temp: Record<number, Dialogue> = {}
    const tasks = []
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        tasks.push(
          await this.db.collection('dialogue').updateOne({ _id: dialogue.id }, { $set: pick(dialogue, fields) }),
        )
        Dialogue.addHistory(dialogue._backup, '修改', argv, false, temp)
      }
    }
    await Promise.all(tasks)
    Object.assign(this.app.teachHistory, temp)
  },

  async revertDialogues(dialogues: Dialogue[], argv: Dialogue.Argv) {
    const created = dialogues.filter(d => d._type === '添加')
    const edited = dialogues.filter(d => d._type !== '添加')
    await this.removeDialogues(created.map(d => d.id), argv, true)
    await this.recoverDialogues(edited, argv)
    return `问答 ${dialogues.map(d => d.id).sort((a, b) => a - b)} 已回退完成。`
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
        { $group: { _id: { $toLower: 'question' }, count: { $sum: 1 } } },
        { $group: { _id: null, counts: { $push: { k: '$_id', v: '$count' } } } },
        { $replaceRoot: { newRoot: { $arrayToObject: '$counts' } } },
      ]).toArray(),
      this.db.collection('dialogue').count(),
    ])
    const questions = Object.keys(data).length
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
      if (answer !== undefined) conditionals.push({ answer: { $regex: new RegExp(answer, 'i') } })
      if (question !== undefined) conditionals.push({ question: { $regex: new RegExp(original, 'i') } })
      return
    }
    if (answer !== undefined) conditionals.push({ answer })
    if (question !== undefined) {
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
