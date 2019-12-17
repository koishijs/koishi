import { injectMethods, extendUser, Activity } from 'koishi-core'
import { escape } from 'mysql'
import {} from 'koishi-database-mysql'
import {} from 'koishi-database-level'

declare module 'koishi-core/dist/database' {
  interface UserData {
    interactiveness: Activity
  }

  interface TableMethods {
    dialogue: DialogueMethods
  }

  interface TableData {
    dialogue: Dialogue
  }
}

interface DialogueMethods {
  createDialogue (options: Dialogue): Promise<Dialogue>
  getDialogueTest (test: DialogueTest): string
  getDialogues (test: number[] | DialogueTest): Promise<Dialogue[]>
  setDialogue (id: number, data: Partial<Dialogue>): Promise<any>
  removeDialogues (ids: number[]): Promise<any>
  getDialogueCount (test: DialogueTest): Promise<DialogueCount>
}

extendUser(() => ({ interactiveness: {} }))

export interface DialogueCount {
  questions: number
  answers: number
}

export interface Dialogue {
  id?: number
  question: string
  answer: string
  writer: number
  groups: string
  flag: number
  probability: number
}

export enum DialogueFlag {
  frozen = 1,
  regexp = 2,
  appellation = 4,
}

export interface DialogueTest {
  envMode?: -2 | -1 | 0 | 1 | 2
  groups?: number[]
  question?: string
  answer?: string
  writer?: number
  keyword?: boolean
  strict?: boolean
  frozen?: boolean
}

injectMethods('mysql', 'dialogue', {
  createDialogue (options) {
    return this.create('dialogues', options)
  },

  getDialogueTest (test) {
    const conditionals: string[] = []
    if (test.keyword) {
      if (test.question) conditionals.push('`question` LIKE ' + escape(`%${test.question}%`))
      if (test.answer) conditionals.push('`answer` LIKE ' + escape(`%${test.answer}%`))
    } else {
      if (test.question) conditionals.push('`question` = ' + escape(test.question))
      if (test.answer) conditionals.push('`answer` = ' + escape(test.answer))
    }
    let envConditional = ''
    if (test.envMode === 2) {
      envConditional = `\`groups\` = "${test.groups.join(',')}"`
    } else if (test.envMode === -2) {
      envConditional = `\`groups\` = "*${test.groups.join(',')}"`
    } else if (test.envMode === 1) {
      envConditional = `\`groups\` NOT LIKE "*%" AND \`groups\` LIKE "%${test.groups.join(',%')}%" OR \`groups\` LIKE "*%" AND ${test.groups.map(id => `\`groups\` NOT LIKE "%${id}%"`).join(' AND ')}`
    } else if (test.envMode === -1) {
      envConditional = `\`groups\` LIKE "*%${test.groups.join(',%')}%" OR \`groups\` NOT LIKE "*%" AND ${test.groups.map(id => `\`groups\` NOT LIKE "%${id}%"`).join(' AND ')}`
    }
    if (envConditional) {
      conditionals.push(`(${envConditional})`)
    }
    if (test.frozen === true) {
      conditionals.push('(`flag` & 1)')
    } else if (test.frozen === false) {
      conditionals.push('!(`flag` & 1)')
    }
    if (test.writer) conditionals.push('`writer` = ' + test.writer)
    if (!conditionals.length) return ''
    return ' WHERE ' + conditionals.join(' AND ')
  },

  async getDialogues (test) {
    if (Array.isArray(test)) {
      if (!test.length) return []
      return this.query(`SELECT * FROM \`dialogues\` WHERE \`id\` IN (${test.join(',')})`)
    }
    return this.query('SELECT * FROM `dialogues`' + this.getDialogueTest(test))
  },

  setDialogue (id, data) {
    return this.update('dialogues', id, data)
  },

  removeDialogues (ids) {
    return this.query(`DELETE FROM \`dialogues\` WHERE \`id\` IN (${ids.join(',')})`)
  },

  async getDialogueCount (test) {
    const [{
      'COUNT(DISTINCT `question`)': questions,
      'COUNT(*)': answers,
    }] = await this.query('SELECT COUNT(DISTINCT `question`), COUNT(*) FROM `dialogues`' + this.getDialogueTest(test))
    return { questions, answers }
  },
})
