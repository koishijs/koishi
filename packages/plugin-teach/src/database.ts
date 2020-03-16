import { injectMethods } from 'koishi-core'
import { arrayTypes } from 'koishi-database-mysql'
import { testDialogue, testGroups } from './utils'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    dialogue: DialogueMethods
  }

  interface TableData {
    dialogue: Dialogue
  }
}

interface DialogueMethods {
  _testQuestionAnswer (test: DialogueTest): string
  createDialogue (options: Dialogue): Promise<Dialogue>
  getDialogues (test: string[] | DialogueTest): Promise<Dialogue[]>
  getSessionDialogues (test: DialogueTest, ids: string[]): Promise<Dialogue[]>
  setDialogue (id: number, data: Partial<Dialogue>): Promise<any>
  removeDialogues (ids: number[]): Promise<any>
  getDialogueCount (): Promise<DialogueCount>
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
  writer: number
  groups: string[]
  flag: number
  probability: number
  successors: string[]
}

arrayTypes.push('dialogue.groups', 'dialogue.successors')

export interface DialogueTest {
  groups?: string[]
  reversed?: boolean
  partial?: boolean

  question?: string
  answer?: string
  keyword?: boolean

  writer?: number
  regexp?: boolean
  frozen?: boolean
  appellation?: boolean

  successors?: string[]
  predecessors?: string[]
}

export enum DialogueFlag {
  frozen = 1,
  regexp = 2,
  keyword = 4,
  reversed = 16,
}

injectMethods('mysql', 'dialogue', {
  _testQuestionAnswer (test) {
    const conditionals: string[] = []
    if (test.keyword) {
      if (test.question) conditionals.push('`question` LIKE ' + this.escape(`%${test.question}%`))
      if (test.answer) conditionals.push('`answer` LIKE ' + this.escape(`%${test.answer}%`))
    } else {
      if (test.question) conditionals.push('`question` = ' + this.escape(test.question))
      if (test.answer) conditionals.push('`answer` = ' + this.escape(test.answer))
    }
    return conditionals.length ? ' WHERE ' + conditionals.join(' AND ') : ''
  },

  createDialogue (options) {
    return this.create('dialogue', options)
  },

  async getDialogues (test) {
    if (Array.isArray(test)) {
      if (!test.length) return []
      return this.query(`SELECT * FROM \`dialogue\` WHERE \`id\` IN (${test.join(',')})`)
    }

    const dialogues = await this.query<Dialogue[]>('SELECT * FROM `dialogue`' + this._testQuestionAnswer(test))
    return dialogues.filter(dialogue => testGroups(dialogue, test) && testDialogue(dialogue, test))
  },

  async getSessionDialogues (test, ids) {
    const dialogues = await this.query<Dialogue[]>('SELECT * FROM `dialogue`' + this._testQuestionAnswer(test))
    return dialogues.filter(dialogue => {
      return testDialogue(dialogue, test) && (ids.includes('' + dialogue.id) || testGroups(dialogue, test))
    })
  },

  setDialogue (id, data) {
    return this.update('dialogue', id, data)
  },

  removeDialogues (ids) {
    if (!ids.length) return
    return this.query(`DELETE FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
  },

  async getDialogueCount () {
    const [{
      'COUNT(DISTINCT `question`)': questions,
      'COUNT(*)': answers,
    }] = await this.query('SELECT COUNT(DISTINCT `question`), COUNT(*) FROM `dialogue`')
    return { questions, answers }
  },
})
