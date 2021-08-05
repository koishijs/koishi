import { Context, Database, clone, defineProperty, Observed, pick } from 'koishi'
import { Dialogue, equal, DialogueTest } from '../utils'
import {} from '@koishijs/plugin-mysql'

declare module 'koishi' {
  interface EventMap {
    'dialogue/mysql'(test: DialogueTest, conditionals?: string[]): void
  }
}

Database.extend('@koishijs/plugin-mysql', {
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

  async updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const data: Partial<Dialogue>[] = []
    const fields = new Set<Dialogue.Field>(['id'])
    for (const { _diff } of dialogues) {
      for (const key in _diff) {
        fields.add(key as Dialogue.Field)
      }
    }
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        data.push(pick(dialogue, fields))
        Dialogue.addHistory(dialogue._backup, '修改', argv, false)
      }
    }
    await this.update('dialogue', data)
  },

  async getDialogueStats() {
    const [{
      'COUNT(DISTINCT `question`)': questions,
      'COUNT(*)': dialogues,
    }] = await this.query<any>('SELECT COUNT(DISTINCT `question`), COUNT(*) FROM `dialogue`')
    return { questions, dialogues }
  },
})

Database.extend('@koishijs/plugin-mysql', ({ Domain, tables }) => {
  tables.dialogue = {
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
  }
})

export default function apply(ctx: Context) {
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
      if (original) conditionals.push('`original` REGEXP ' + escape(original))
      return
    }

    if (answer) conditionals.push('`answer` = ' + escape(answer))
    if (regexp === false) {
      if (question) conditionals.push('`question` = ' + escape(question))
    } else if (original) {
      const conds = [`\`flag\` & ${Dialogue.Flag.regexp} && ${escape(original)} REGEXP \`original\``]
      if (question) conds.push(`!(\`flag\` & ${Dialogue.Flag.regexp}) && \`question\` = ${escape(question)}`)
      conditionals.push(`(${conds.join(' || ')})`)
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
