import { Context, Database } from 'koishi-core'
import { clone, defineProperty, Observed, pick } from 'koishi-utils'
import { Dialogue, equal, DialogueTest } from '../utils'
import {} from 'koishi-plugin-mysql'

declare module 'koishi-core' {
  interface EventMap {
    'dialogue/mysql'(test: DialogueTest, conditionals?: string[]): void
  }
}

Database.extend('koishi-plugin-mysql', {
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
    const dialogues = await this.query<Dialogue[]>(query)
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues.filter((data) => {
      if (!test.groups || test.partial) return true
      return !(data.flag & Dialogue.Flag.complement) === test.reversed || !equal(test.groups, data.groups)
    })
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

Database.extend('koishi-plugin-mysql', ({ Domain, tables }) => {
  tables.dialogue = Object.assign<any, any>([
    'PRIMARY KEY (`id`) USING BTREE',
  ], {
    id: `INT(11) UNSIGNED NOT NULL AUTO_INCREMENT`,
    flag: `INT(10) UNSIGNED NOT NULL DEFAULT '0'`,
    probS: `DECIMAL(4,3) UNSIGNED NOT NULL DEFAULT '1.000'`,
    probA: `DECIMAL(4,3) UNSIGNED NOT NULL DEFAULT '0.000'`,
    startTime: `INT(10) NOT NULL DEFAULT '0'`,
    endTime: `INT(10) NOT NULL DEFAULT '0'`,
    groups: new Domain.Array(`TINYTEXT`),
    original: `TINYTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci'`,
    question: `TINYTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci'`,
    answer: `TEXT(65535) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci'`,
    predecessors: new Domain.Array(`TINYTEXT`),
    successorTimeout: `INT(10) UNSIGNED NOT NULL DEFAULT '0'`,
    writer: 'INT(11) UNSIGNED',
  })
})

export default function apply(ctx: Context, config: Dialogue.Config) {
  config.validateRegExp = {
    onEscapeCharacterSet() {
      throw new SyntaxError('unsupported escape character set')
    },
    onQuantifier(start, end, min, max, greedy) {
      if (!greedy) throw new SyntaxError('unsupported non-greedy quantifier')
    },
    onWordBoundaryAssertion() {
      throw new SyntaxError('unsupported word boundary assertion')
    },
    onLookaroundAssertionEnter() {
      throw new SyntaxError('unsupported lookaround assertion')
    },
    onGroupEnter() {
      throw new SyntaxError('unsupported non-capturing group')
    },
    onCapturingGroupEnter(start, name) {
      if (name) throw new SyntaxError('unsupported named capturing group')
    },
  }

  ctx.on('dialogue/flag', (flag) => {
    ctx.on('dialogue/mysql', (test, conditionals) => {
      if (test[flag] === undefined) return
      conditionals.push(`!(\`flag\` & ${Dialogue.Flag[flag]}) = !${test[flag]}`)
    })
  })

  ctx.on('dialogue/mysql', ({ regexp, answer, question, original }, conditionals) => {
    const { escape } = require('mysql') as typeof import('mysql')

    if (regexp) {
      if (answer) conditionals.push('`answer` REGEXP ' + escape(answer))
      if (question) conditionals.push('`question` REGEXP ' + escape(original))
      return
    }

    if (answer) conditionals.push('`answer` = ' + escape(answer))
    if (question) {
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
      !(\`flag\` & ${Dialogue.Flag.complement}) != ${test.reversed} && ${test.groups.map(id => `FIND_IN_SET("${id}", \`groups\`)`).join(' && ')} ||
      !(\`flag\` & ${Dialogue.Flag.complement}) = ${test.reversed} && ${test.groups.map(id => `!FIND_IN_SET("${id}", \`groups\`)`).join(' && ')}
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
