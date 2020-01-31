import { injectMethods } from 'koishi-core'
import {} from 'koishi-database-mysql'
import {} from 'koishi-database-level'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    dialogue: DialogueMethods
  }

  interface TableData {
    dialogue: Dialogue
  }
}

interface DialogueMethods {
  _getDialogueTest (test: DialogueTest): string
  _testDialogue (test: DialogueTest, data: Dialogue): boolean
  createDialogue (options: Dialogue): Promise<Dialogue>
  getDialogues (test: number[] | DialogueTest): Promise<Dialogue[]>
  setDialogue (id: number, data: Partial<Dialogue>): Promise<any>
  removeDialogues (ids: number[]): Promise<any>
  getDialogueCount (test: DialogueTest): Promise<DialogueCount>
}

export interface DialogueCount {
  questions: number
  answers: number
}

export interface Dialogue {
  id?: number
  question: string
  answer: string
  writer: number
  groups: number[]
  flag: number
  probability: number
}

export interface DialogueTest {
  groups?: number[]
  reversed?: boolean
  partial?: boolean

  question?: string
  answer?: string
  keyword?: boolean

  writer?: number
  regexp?: boolean
  frozen?: boolean
}

export enum DialogueFlag {
  frozen = 1,
  regexp = 2,
  keyword = 4,
  appellation = 8,
  reversed = 16,
}

// injectMethods('mysql', 'dialogue', {
//   _getDialogueTest (test) {
//     const conditionals: string[] = []
//     if (test.keyword) {
//       if (test.question) conditionals.push('`question` LIKE ' + this.escape(`%${test.question}%`))
//       if (test.answer) conditionals.push('`answer` LIKE ' + this.escape(`%${test.answer}%`))
//     } else {
//       // TODO: support dialogue.keyword in mysql
//       if (test.question) conditionals.push('`question` = ' + this.escape(test.question))
//       if (test.answer) conditionals.push('`answer` = ' + this.escape(test.answer))
//     }
//     let envConditional = ''
//     if (test.envMode === 2) {
//       envConditional = `\`groups\` = "${test.groups.join(',')}"`
//     } else if (test.envMode === -2) {
//       envConditional = `\`groups\` = "*${test.groups.join(',')}"`
//     } else if (test.envMode === 1) {
//       envConditional = `\`groups\` NOT LIKE "*%" AND \`groups\` LIKE "%${test.groups.join(',%')}%" OR \`groups\` LIKE "*%" AND ${test.groups.map(id => `\`groups\` NOT LIKE "%${id}%"`).join(' AND ')}`
//     } else if (test.envMode === -1) {
//       envConditional = `\`groups\` LIKE "*%${test.groups.join(',%')}%" OR \`groups\` NOT LIKE "*%" AND ${test.groups.map(id => `\`groups\` NOT LIKE "%${id}%"`).join(' AND ')}`
//     }
//     if (envConditional) {
//       conditionals.push(`(${envConditional})`)
//     }
//     if (test.frozen === true) {
//       conditionals.push('(`flag` & 1)')
//     } else if (test.frozen === false) {
//       conditionals.push('!(`flag` & 1)')
//     }
//     if (test.writer) conditionals.push('`writer` = ' + test.writer)
//     if (!conditionals.length) return ''
//     return ' WHERE ' + conditionals.join(' AND ')
//   },

//   createDialogue (options) {
//     return this.create('dialogue', options)
//   },

//   async getDialogues (test) {
//     if (Array.isArray(test)) {
//       if (!test.length) return []
//       return this.query(`SELECT * FROM \`dialogue\` WHERE \`id\` IN (${test.join(',')})`)
//     }
//     return this.query('SELECT * FROM `dialogue`' + this._getDialogueTest(test))
//   },

//   setDialogue (id, data) {
//     return this.update('dialogue', id, data)
//   },

//   removeDialogues (ids) {
//     return this.query(`DELETE FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
//   },

//   async getDialogueCount (test) {
//     const [{
//       'COUNT(DISTINCT `question`)': questions,
//       'COUNT(*)': answers,
//     }] = await this.query('SELECT COUNT(DISTINCT `question`), COUNT(*) FROM `dialogue`' + this._getDialogueTest(test))
//     return { questions, answers }
//   },
// })

// injectMethods('level', 'dialogue', {
//   _testDialogue (test, data) {
//     if (test.keyword) {
//       if (test.question && !data.question.includes(test.question)) return
//       if (test.answer && !data.answer.includes(test.answer)) return
//     } else if (data.flag & Dialogue.Flags.keyword) {
//       if (test.question && !test.question.includes(data.question)) return
//       if (test.answer && !test.answer.includes(data.answer)) return
//     } else {
//       if (test.question && data.question !== test.question) return
//       if (test.answer && data.answer !== test.answer) return
//     }
//     if (test.envMode === 2) {
//       // TODO:
//     }
//     if (test.frozen === true) {
//       if (!(data.flag & 1)) return
//     } else if (test.frozen === false) {
//       if (data.flag & 1) return
//     }
//     if (test.writer && data.writer !== test.writer) return
//     return true
//   },

//   createDialogue (options) {
//     return this.create('dialogue', options)
//   },

//   async getDialogues (test) {
//     if (Array.isArray(test)) {
//       if (!test.length) return []
//       const data = await Promise.all(test.map(id => this.tables.dialogue.get(id)))
//       return data.filter(Boolean)
//     }

//     return new Promise((resolve, reject) => {
//       const dialogues: Dialogue[] = []
//       this.tables.dialogue.createValueStream()
//         .on('data', data => this._testDialogue(test, data) && dialogues.push(data))
//         .on('error', error => reject(error))
//         .on('end', () => resolve(dialogues))
//     })
//   },

//   async setDialogue (id, data) {
//     const originalData = await this.tables.dialogue.get(id)
//     const newData: Dialogue = { ...originalData, ...data }
//     return this.tables.dialogue.put(id, newData)
//   },

//   removeDialogues (ids) {
//     return Promise.all(ids.map(id => this.remove('dialogue', id)))
//   },

//   async getDialogueCount (test) {
//     return new Promise((resolve, reject) => {
//       const questionSet = new Set<string>()
//       let answers = 0
//       this.tables.dialogue.createValueStream()
//         .on('data', data => this._testDialogue(test, data) && (questionSet.add(data.question), ++answers))
//         .on('error', error => reject(error))
//         .on('end', () => resolve({ questions: questionSet.size, answers }))
//     })
//   },
// })
