import { injectMethods } from 'koishi-core'
import { arrayTypes } from 'koishi-database-mysql'
import { Observed } from 'koishi-utils'

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    dialogue: DialogueMethods
  }

  interface TableData {
    dialogue: Dialogue
  }
}

export namespace Dialogue {
  export interface UpdateContext {
    skipped?: number[]
    updated?: number[]
  }
}

export type DialogueField = keyof Dialogue

interface DialogueMethods {
  createDialogue (options: Dialogue): Promise<Dialogue>
  getDialoguesById <K extends DialogueField> (ids: (string | number)[], keys?: readonly K[]): Promise<Pick<Dialogue, K>[]>
  setDialogue (id: number, data: Partial<Dialogue>): Promise<void>
  setDialogues (data: Observed<Dialogue>[], ctx: Dialogue.UpdateContext): Promise<void>
  removeDialogues (ids: number[]): Promise<void>
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
}

arrayTypes.push('dialogue.groups', 'dialogue.predecessors')

export interface DialogueTest {
  question?: string
  answer?: string
  keyword?: boolean
  regexp?: boolean
  activated?: boolean
  appellative?: boolean
}

export enum DialogueFlag {
  frozen = 1,
  regexp = 2,
  keyword = 4,
  reversed = 16,
  redirect = 32,
}

function pick <T, K extends keyof T> (source: T, keys: Iterable<K>): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = source[key]
  }
  return result
}

injectMethods('mysql', 'dialogue', {
  createDialogue (options) {
    return this.create('dialogue', options)
  },

  async getDialoguesById (ids, keys) {
    if (!ids.length) return []
    return this.select('dialogue', keys, `\`id\` IN (${ids.join(',')})`)
  },

  async setDialogue (id, data) {
    await this.update('dialogue', id, data)
  },

  async setDialogues (dialogues, ctx) {
    const data: Partial<Dialogue>[] = []
    const fields = new Set<DialogueField>(['id'])
    for (const { _diff } of dialogues) {
      for (const key in _diff) {
        fields.add(key as DialogueField)
      }
    }
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        ctx.skipped.push(dialogue.id)
      } else {
        dialogue._diff = {}
        ctx.updated.push(dialogue.id)
        data.push(pick(dialogue, fields))
      }
    }
    await this.update('dialogue', data)
  },

  async removeDialogues (ids) {
    if (!ids.length) return
    await this.query(`DELETE FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
  },
})
