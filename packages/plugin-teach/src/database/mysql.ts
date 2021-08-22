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
})

export default function apply(ctx: Context) {
  ctx.on('dialogue/mysql', (test, conditionals) => {
    if (!test.groups || !test.groups.length) return
    conditionals.push(`(
      !(\`flag\` & ${Dialogue.Flag.complement}) != ${test.reversed} && ${test.groups.map(id => `FIND_IN_SET("${id}", \`groups\`)`).join(' && ')} ||
      !(\`flag\` & ${Dialogue.Flag.complement}) = ${test.reversed} && ${test.groups.map(id => `!FIND_IN_SET("${id}", \`groups\`)`).join(' && ')}
    )`)
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
}
