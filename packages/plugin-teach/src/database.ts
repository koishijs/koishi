import { injectMethods } from 'koishi-core'
import { arrayTypes } from 'koishi-database-mysql'
import { Observed, pick } from 'koishi-utils'
import { TeachArgv } from './utils'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    dialogue: DialogueMethods
  }

  interface TableData {
    dialogue: Dialogue
  }
}

export namespace Dialogue {
  const history: Record<number, Dialogue> = []

  export interface UpdateContext {
    skipped?: number[]
    updated?: number[]
  }

  export async function fromIds (ids: number[]) {
    if (!ids.length) return []
    return this.select('dialogue', [], `\`id\` IN (${ids.join(',')})`)
  }

  export async function create (dialogue: Dialogue, argv: TeachArgv) {
    const timestamp = Date.now()
    dialogue = await argv.ctx.database.mysql.create('dialogue', dialogue)
    history[dialogue.id] = dialogue
    dialogue._timestamp = timestamp
    dialogue._operator = argv.meta.userId
    dialogue._state = 'created'
    return dialogue
  }

  export async function update (dialogues: Observed<Dialogue>[], argv: TeachArgv) {
    const data: Partial<Dialogue>[] = []
    const fields = new Set<DialogueField>(['id'])
    for (const { _diff } of dialogues) {
      for (const key in _diff) {
        fields.add(key as DialogueField)
      }
    }
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        data.push(pick(dialogue, fields))
      }
    }
    await this.update('dialogue', data)
  }

  export async function remove (ids: number[], argv: TeachArgv) {
    const timestamp = Date.now()
    await argv.ctx.database.mysql.query(`DELETE FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
    for (const id of ids) {
      const dialogue = history[id] = argv.dialogueMap[id]
      dialogue._timestamp = timestamp
      dialogue._operator = argv.meta.userId
      dialogue._state = 'removed'
    }
  }
}

export type DialogueField = keyof Dialogue

interface DialogueMethods {
  setDialogue (id: number, data: Partial<Dialogue>): Promise<void>
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
  _weight?: number
  _capture?: RegExpExecArray
  _strict?: boolean
  _state?: 'created' | 'edited' | 'removed'
  _operator?: number
  _timestamp?: number
}

arrayTypes.push('dialogue.groups', 'dialogue.predecessors')

export interface DialogueTest {
  original?: string
  question?: string
  answer?: string
  keyword?: boolean
  regexp?: boolean
  activated?: boolean
  appellative?: boolean
}

export enum DialogueFlag {
  /** 冻结：只有 4 级以上权限者可修改 */
  frozen = 1,
  /** 正则：使用正则表达式进行匹配 */
  regexp = 2,
  /** 任意人：后继问答可以被上下文内任何人触发 */
  indefinite = 4,
  /** 代行者：由教学者完成回答的执行 */
  substitute = 8,
  /** 补集：上下文匹配时取补集 */
  complement = 16,
}

injectMethods('mysql', 'dialogue', {
  async setDialogue (id, data) {
    await this.update('dialogue', id, data)
  },
})
