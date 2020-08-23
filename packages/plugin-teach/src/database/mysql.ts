import { Context, extendDatabase, Message } from 'koishi-core'
import { clone, defineProperty, Observed, pick } from 'koishi-utils'
import { Dialogue, DialogueTest } from '../utils'
import { escape } from 'mysql'
import { RegExpError } from '../internal'
import { format } from 'util'
import MysqlDatabase from 'koishi-plugin-mysql/dist/database'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/mysql'(test: DialogueTest, conditionals?: string[]): void
  }
}

declare module 'koishi-core/dist/plugins/message' {
  namespace Message {
    export namespace Teach {
      let WhitespaceCharset: string
      let NonspaceCharset: string
      let UnsupportedCharset: string
      let UnsupportedWordBoundary: string
      let UnsupportedNongreedy: string
      let UnsupportedLookaround: string
      let UnsupportedNoncapturing: string
      let UnsupportedNamedGroup: string
    }
  }
}

Message.Teach.WhitespaceCharset = '问题中的空白字符会被自动删除，你无需使用 \\s。'
Message.Teach.NonspaceCharset = '问题中的空白字符会被自动删除，请使用 . 代替 \\S。'
Message.Teach.UnsupportedCharset = '目前不支持在正则表达式中使用 \\%s，请使用 [%s] 代替。'
Message.Teach.UnsupportedWordBoundary = '目前不支持在正则表达式中使用单词边界。'
Message.Teach.UnsupportedNongreedy = '目前不支持在正则表达式中使用非捕获组。'
Message.Teach.UnsupportedLookaround = '目前不支持在正则表达式中使用断言。'
Message.Teach.UnsupportedNoncapturing = '目前不支持在正则表达式中使用非捕获组。'
Message.Teach.UnsupportedNamedGroup = '目前不支持在正则表达式中使用具名组。'

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', {
  async getDialoguesById(ids, fields) {
    if (!ids.length) return []
    const dialogues = await this.select<Dialogue>('dialogue', fields, `\`id\` IN (${ids.join(',')})`)
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues
  },

  async getDialoguesByTest(test: DialogueTest) {
    let query = 'SELECT * FROM `dialogue`'
    const conditionals: string[] = []
    this.app.emit('dialogue/mysql', test, conditionals)
    if (conditionals.length) query += ' WHERE ' + conditionals.join(' && ')
    const dialogues = (await this.query<Dialogue[]>(query))
      .filter((dialogue) => !this.app.bail('dialogue/fetch', dialogue, test))
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues
  },

  async createDialogue(dialogue: Dialogue, argv: Dialogue.Argv, revert = false) {
    dialogue = await this.create('dialogue', dialogue)
    Dialogue.addHistory(dialogue, '添加', argv, revert)
    return dialogue
  },

  async removeDialogues(ids: number[], argv: Dialogue.Argv, revert = false) {
    if (!ids.length) return
    await this.query(`DELETE FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
    for (const id of ids) {
      Dialogue.addHistory(argv.dialogueMap[id], '删除', argv, revert)
    }
  },

  async updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const data: Partial<Dialogue>[] = []
    const fields = new Set<Dialogue.Field>(['id'])
    for (const { _diff } of dialogues) {
      for (const key in _diff) {
        fields.add(key as Dialogue.Field)
      }
    }
    const temp: Record<number, Dialogue> = {}
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        data.push(pick(dialogue, fields))
        Dialogue.addHistory(dialogue._backup, '修改', argv, false, temp)
      }
    }
    await this.update('dialogue', data)
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
    await this.update('dialogue', dialogues)
    for (const dialogue of dialogues) {
      Dialogue.addHistory(dialogue, '修改', argv, true)
    }
  },

  async getDialogueStats() {
    const [{
      'COUNT(DISTINCT `question`)': questions,
      'COUNT(*)': dialogues,
    }] = await this.query<any>('SELECT COUNT(DISTINCT `question`), COUNT(*) FROM `dialogue`')
    return { questions, dialogues }
  },
})

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', ({ listFields }) => {
  listFields.push('dialogue.groups', 'dialogue.predecessors')
})

export default function apply(ctx: Context, config: Dialogue.Config) {
  config.validateRegExp = {
    onEscapeCharacterSet(start, end, kind, negate) {
      // eslint-disable-next-line curly
      if (kind === 'space') throw negate
        ? new RegExpError(Message.Teach.WhitespaceCharset)
        : new RegExpError(Message.Teach.NonspaceCharset)
      let chars = kind === 'digit' ? '0-9' : '_0-9a-z'
      let source = kind === 'digit' ? 'd' : 'w'
      if (negate) {
        chars = '^' + chars
        source = source.toUpperCase()
      }
      throw new RegExpError(format(Message.Teach.UnsupportedCharset, source, chars))
    },
    onQuantifier(start, end, min, max, greedy) {
      if (!greedy) throw new RegExpError(Message.Teach.UnsupportedNongreedy)
    },
    onWordBoundaryAssertion() {
      throw new RegExpError(Message.Teach.UnsupportedWordBoundary)
    },
    onLookaroundAssertionEnter() {
      throw new RegExpError(Message.Teach.UnsupportedLookaround)
    },
    onGroupEnter() {
      throw new RegExpError(Message.Teach.UnsupportedNoncapturing)
    },
    onCapturingGroupEnter(start, name) {
      if (name) throw new RegExpError(Message.Teach.UnsupportedNamedGroup)
    },
  }

  ctx.on('dialogue/flag', (flag) => {
    ctx.on('dialogue/mysql', (test, conditionals) => {
      if (test[flag] === undefined) return
      conditionals.push(`!(\`flag\` & ${Dialogue.Flag[flag]}) = !${test[flag]}`)
    })
  })

  ctx.on('dialogue/mysql', ({ regexp, answer, question, original }, conditionals) => {
    if (regexp) {
      if (answer !== undefined) conditionals.push('`answer` REGEXP ' + escape(answer))
      if (question !== undefined) conditionals.push('`question` REGEXP ' + escape(original))
      return
    }

    if (answer !== undefined) conditionals.push('`answer` = ' + escape(answer))
    if (question !== undefined) {
      if (regexp === false) {
        conditionals.push('`question` = ' + escape(question))
      } else {
        conditionals.push(`(\
          !(\`flag\` & ${Dialogue.Flag.regexp}) && \`question\` = ${escape(question)} ||\
          \`flag\` & ${Dialogue.Flag.regexp} && (\
            ${escape(question)} REGEXP \`question\` || ${escape(original)} REGEXP \`question\`\
          )\
        )`)
      }
    }
  })

  ctx.on('dialogue/mysql', (test, conditionals) => {
    if (!test.groups || !test.groups.length) return
    conditionals.push(`(
      !(\`flag\` & ${Dialogue.Flag.complement}) != ${test.reversed} && ${test.groups.map(id => `FIND_IN_SET(${id}, \`groups\`)`).join(' && ')} ||
      !(\`flag\` & ${Dialogue.Flag.complement}) = ${test.reversed} && ${test.groups.map(id => `!FIND_IN_SET(${id}, \`groups\`)`).join(' && ')}
    )`)
  })

  ctx.on('dialogue/mysql', ({ predecessors, stateful, noRecursive }, conditionals) => {
    if (noRecursive) {
      conditionals.push('!`predecessors`')
    } else if (predecessors !== undefined) {
      const segments = predecessors.map(id => `FIND_IN_SET(${id}, \`predecessors\`)`)
      if (stateful) {
        conditionals.push(`(${['!`predecessors`', ...segments].join('||')})`)
      } else if (predecessors.length) {
        conditionals.push(`(${segments.join('||')})`)
      }
    }
  })

  function getProduct(time: number) {
    return `(\`startTime\`-${time})*(${time}-\`endTime\`)*(\`endTime\`-\`startTime\`)`
  }

  ctx.on('dialogue/mysql', (test, conditionals) => {
    if (test.matchTime !== undefined) {
      conditionals.push(getProduct(test.matchTime) + '>=0')
    }
    if (test.mismatchTime !== undefined) {
      conditionals.push(getProduct(test.matchTime) + '<0')
    }
  })

  ctx.on('dialogue/mysql', (test, conditionals) => {
    if (test.writer !== undefined) conditionals.push(`\`writer\` = ${test.writer}`)
  })
}
