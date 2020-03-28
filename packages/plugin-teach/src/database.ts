import { injectMethods } from 'koishi-core'
import { arrayTypes } from 'koishi-database-mysql'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    dialogue: DialogueMethods
  }

  interface TableData {
    dialogue: Dialogue
  }
}

interface DialogueMethods {
  createDialogue (options: Dialogue): Promise<Dialogue>
  getDialogues (test: string[]): Promise<Dialogue[]>
  getDialoguesByTest (test: DialogueTest): Promise<Dialogue[]>
  setDialogue (id: number, data: Partial<Dialogue>): Promise<any>
  removeDialogues (ids: number[]): Promise<any>
}

export interface DialogueCount {
  questions: number
  answers: number
}

export interface Dialogue {
  id?: number
  question: string
  answer: string
  original: string
  flag: number
  probS: number
  probA: number
  _prob?: number
}

arrayTypes.push('dialogue.groups', 'dialogue.successors')

export enum AppellationType { normal, appellative, activated }

export interface DialogueTest {
  question?: string
  answer?: string
  keyword?: boolean
  regexp?: boolean
  appellative?: AppellationType
}

export enum DialogueFlag {
  frozen = 1,
  regexp = 2,
  keyword = 4,
  reversed = 16,
  redirect = 32,
}

injectMethods('mysql', 'dialogue', {
  createDialogue (options) {
    return this.create('dialogue', options)
  },

  async getDialogues (ids) {
    if (!ids.length) return []
    return this.query(`SELECT * FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
  },

  async getDialoguesByTest (test) {
    let query = 'SELECT * FROM `dialogue`'
    const conditionals: string[] = []
    if (test.keyword) {
      if (test.question) conditionals.push('`question` LIKE ' + this.escape(`%${test.question}%`))
      if (test.answer) conditionals.push('`answer` LIKE ' + this.escape(`%${test.answer}%`))
    } else {
      if (test.question) conditionals.push('`question` = ' + this.escape(test.question))
      if (test.answer) conditionals.push('`answer` = ' + this.escape(test.answer))
    }
    if (conditionals.length) query += ' WHERE ' + conditionals.join(' AND ')
    return this.query<Dialogue[]>(query)
  },

  setDialogue (id, data) {
    return this.update('dialogue', id, data)
  },

  removeDialogues (ids) {
    if (!ids.length) return
    return this.query(`DELETE FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
  },
})
