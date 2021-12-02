/* eslint-disable no-irregular-whitespace */

import { clone, Context, defineProperty, Observed, pick, Query, Schema, Time } from 'koishi'
import { Dialogue, DialogueTest, equal } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import update from './update'
import context from './plugins/context'
import throttle from './plugins/throttle'
import probability from './plugins/probability'
import successor from './plugins/successor'
import time from './plugins/time'
import writer from './plugins/writer'
import command from './plugins/command'
import console from './plugins/console'

export * from './utils'
export * from './receiver'
export * from './search'
export * from './update'
export * from './plugins/context'
export * from './plugins/throttle'
export * from './plugins/probability'
export * from './plugins/successor'
export * from './plugins/time'
export * from './plugins/writer'

export type Config = Dialogue.Config

declare module 'koishi' {
  interface EventMap {
    'dialogue/validate'(argv: Dialogue.Argv): void | string
    'dialogue/execute'(argv: Dialogue.Argv): void | Promise<void | string>
  }

  interface Modules {
    teach: typeof import('.')
  }

  namespace Context {
    interface Services {
      teach: Teach
    }
  }
}

Context.service('teach')

class Teach {
  static using = ['database']

  history: Record<number, Dialogue> = {}

  constructor(private ctx: Context, public config: Config) {
    ctx.teach = this

    // features
    ctx.plugin(command, config)
    ctx.plugin(receiver, config)
    ctx.plugin(search, config)
    ctx.plugin(update, config)
    ctx.plugin(console, config)
  
    // options
    ctx.plugin(internal, config)
    ctx.plugin(context, config)
    ctx.plugin(throttle, config)
    ctx.plugin(probability, config)
    ctx.plugin(successor, config)
    ctx.plugin(time, config)
    ctx.plugin(writer, config)
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
        if (!test.groups || test.partial) return true
        return !(data.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.groups, data.groups)
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
    return this.ctx.database.aggregate('dialogue', {
      dialogues: { $count: 'id' },
      questions: { $count: 'question' },
    })
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

namespace Teach {
  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      prefix: Schema.string().description('教学指令的前缀。').default('#'),
      historyTimeout: Schema.number().description('教学操作在内存中的保存时间。').default(Time.minute * 10),
    }).description('通用设置'),

    Schema.object({
      authority: Schema.object({
        base: Schema.number().description('可访问教学系统的权限等级。').default(2),
        admin: Schema.number().description('可修改非自己创建的问答的权限等级。').default(3),
        context: Schema.number().description('可修改上下文设置的权限等级。').default(3),
        frozen: Schema.number().description('可修改锁定的问答的权限等级。').default(4),
        regExp: Schema.number().description('可使用正则表达式的权限等级。').default(3),
        writer: Schema.number().description('可设置作者或匿名的权限等级。').default(2),
      }),
    }).description('权限设置'),

    Schema.object({
      maxRedirections: Schema.number().description('问题重定向的次数上限。').default(3),
      successorTimeout: Schema.number().description('问答触发后继问答的持续时间。').default(Time.second * 20),
      appellationTimeout: Schema.number().description('称呼作为问题触发的后续效果持续时间。').default(Time.minute * 10),
    }).description('触发设置'),

    Schema.object({
      maxPreviews: Schema.number().description('同时查看的最大问答数量。').default(10),
      previewDelay: Schema.number().description('显示两个问答之间的时间间隔。').default(Time.second * 0.5),
      itemsPerPage: Schema.number().description('搜索结果每一页显示的最大数量。').default(30),
      maxAnswerLength: Schema.number().description('搜索结果中回答显示的长度限制。').default(100),
      mergeThreshold: Schema.number().description('合并搜索模式中，相同的问题和回答被合并的最小数量。').default(5),
    }).description('显示设置'),
  ])
}

export default Teach
