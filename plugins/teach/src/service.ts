import { $, clone, Context, defineProperty, Observed, pick, Query, Service } from 'koishi'
import { Dialogue, DialogueTest, equal } from './utils'

declare module 'koishi' {
  namespace Context {
    interface Services {
      teach: Teach
    }
  }
}

export default class Teach extends Service {
  history: Record<number, Dialogue> = {}

  constructor(ctx: Context, public config: Dialogue.Config) {
    super(ctx, 'teach', true)

    ctx.model.extend('dialogue', {
      id: 'unsigned',
      flag: 'unsigned(4)',
      probS: { type: 'decimal', precision: 4, scale: 3, initial: 1 },
      probA: { type: 'decimal', precision: 4, scale: 3, initial: 0 },
      startTime: 'integer',
      endTime: 'integer',
      guilds: 'list(255)',
      original: 'string(255)',
      question: 'string(255)',
      answer: 'text',
      predecessors: 'list(255)',
      successorTimeout: 'unsigned',
      writer: 'string(255)',
    }, {
      autoInc: true,
    })
  }

  get(test: DialogueTest): Promise<Dialogue[]>
  get<K extends Dialogue.Field>(ids: number[], fields?: K[]): Promise<Pick<Dialogue, K>[]>
  async get(test: DialogueTest | number[], fields?: Dialogue.Field[]) {
    if (Array.isArray(test)) {
      const dialogues = await this.ctx.database.get('dialogue', test, fields)
      dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
      return dialogues
    } else {
      const query: Query.Expr<Dialogue> = { $and: [] }
      this.ctx.emit('dialogue/test', test, query)
      const dialogues = await this.ctx.database.get('dialogue', query)
      dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
      return dialogues.filter((data) => {
        if (!test.guilds || test.partial) return true
        return !(data.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.guilds, data.guilds)
      })
    }
  }

  async update(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const data: Partial<Dialogue>[] = []
    const fields = new Set<Dialogue.Field>(['id'])
    for (const { $diff } of dialogues) {
      for (const key in $diff) {
        fields.add(key as Dialogue.Field)
      }
    }
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue.$diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue.$diff = {}
        argv.updated.push(dialogue.id)
        data.push(pick(dialogue, fields))
        this.addHistory(dialogue._backup, '修改', argv, false)
      }
    }
    await argv.app.database.upsert('dialogue', data)
  }

  async stats(): Promise<Dialogue.Stats> {
    const selection = this.ctx.database.select('dialogue')
    const [dialogues, questions] = await Promise.all([
      selection.evaluate(row => $.count(row.id)).execute(),
      selection.evaluate(row => $.count(row.question)).execute(),
    ])
    return { dialogues, questions }
  }

  async remove(dialogues: Dialogue[], argv: Dialogue.Argv, revert = false) {
    const ids = dialogues.map(d => d.id)
    argv.app.database.remove('dialogue', ids)
    for (const id of ids) {
      this.addHistory(argv.dialogueMap[id], '删除', argv, revert)
    }
    return ids
  }

  async revert(dialogues: Dialogue[], argv: Dialogue.Argv) {
    const created = dialogues.filter(d => d._type === '添加')
    const edited = dialogues.filter(d => d._type !== '添加')
    await this.remove(created, argv, true)
    await this.recover(edited, argv)
    return `问答 ${dialogues.map(d => d.id).sort((a, b) => a - b)} 已回退完成。`
  }

  async recover(dialogues: Dialogue[], argv: Dialogue.Argv) {
    await argv.app.database.upsert('dialogue', dialogues)
    for (const dialogue of dialogues) {
      this.addHistory(dialogue, '修改', argv, true)
    }
  }

  addHistory(dialogue: Dialogue, type: Dialogue.ModifyType, argv: Dialogue.Argv, revert: boolean) {
    if (revert) return delete this.history[dialogue.id]
    this.history[dialogue.id] = dialogue
    const time = Date.now()
    defineProperty(dialogue, '_timestamp', time)
    defineProperty(dialogue, '_operator', argv.session.userId)
    defineProperty(dialogue, '_type', type)
    setTimeout(() => {
      if (this.history[dialogue.id]?._timestamp === time) {
        delete this.history[dialogue.id]
      }
    }, argv.config.historyTimeout ?? 600000)
  }
}
