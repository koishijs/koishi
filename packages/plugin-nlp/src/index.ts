import { Command, Meta, Context, ParsedLine, ParsedCommandLine } from 'koishi-core'
import { tag } from 'nodejieba'
import { resolve } from 'path'

declare module 'koishi-core/dist/command' {
  interface Command {
    intend (keyword: string, callback: IntenderCallback): void
    intend (keywords: string[], callback: IntenderCallback): void
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $tags?: TagResult[]
  }
}

export interface Intension extends Partial<ParsedLine> {
  confidence?: number
}

export type IntenderCallback = (meta: Meta, keyword: string) => Intension

// TODO: pending nodejieba typings
interface TagResult {
  word: string
  tag: string
}

export interface Intender {
  command: Command
  keywords: string[]
  callback: IntenderCallback
}

export interface NlpConfig {
  // TODO: pending nodejieba typings
  dict?: string
  hmmDict?: string
  userDict?: string
  idfDict?: string
  stopWordDict?: string
  threshold?: number
}

const intenders: Intender[] = []

Command.prototype.intend = function (this: Command, arg0: string | string[], callback: IntenderCallback) {
  const keywords = typeof arg0 === 'string' ? [arg0] : arg0
  intenders.push({ command: this, keywords, callback })
}

export const name = 'nlp'

const cwd = process.cwd()

function resolvePathConfig (value?: string) {
  if (value) return resolve(cwd, value)
}

export function apply (ctx: Context, options: NlpConfig = {}) {
  options = { threshold: 0.5, ...options }
  options.dict = resolvePathConfig(options.dict)
  options.hmmDict = resolvePathConfig(options.hmmDict)
  options.idfDict = resolvePathConfig(options.idfDict)
  options.userDict = resolvePathConfig(options.userDict)
  options.stopWordDict = resolvePathConfig(options.stopWordDict)

  ctx.middleware((meta, next) => {
    let max = options.threshold
    let bestFit: ParsedCommandLine

    for (const { keywords, callback, command } of intenders) {
      // find matched keyword
      const keyword = keywords.find(k => meta.message.includes(k))
      if (!keyword) continue

      // attach word tags
      if (!meta.$tags) meta.$tags = tag(meta.message)

      // generate intension
      const intension = callback(meta, keyword)
      if (!intension) return

      // find most credible intension
      const confidence = intension.confidence ?? 1
      if (confidence > max) {
        max = confidence
        bestFit = { meta, command, ...intension }
      }
    }

    if (bestFit) {
      return bestFit.command.execute(bestFit, next)
    } else {
      return next()
    }
  })
}
