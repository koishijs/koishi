import { Command, Meta, Context, ParsedLine, ParsedCommandLine } from 'koishi-core'
import { tag } from 'nodejieba'

declare module 'koishi-core/dist/command' {
  interface Command {
    intend (keyword: string, callback: IntenderCallback): void
    intend (keywords: string[], callback: IntenderCallback): void
  }
}

declare module 'koishi-core/dist/parser' {
  interface ParsedLine {
    confidence?: number
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $tags?: TagResult[]
  }
}

type IntenderCallback = (meta: Meta, keyword: string) => ParsedLine

interface TagResult {
  word: string
  tag: string
}

interface Intender {
  command: Command
  keywords: string[]
  callback: IntenderCallback
}

interface NlpConfig {
  threshold?: number
}

const intenders: Intender[] = []

Command.prototype.intend = function (this: Command, arg0: string | string[], callback: IntenderCallback) {
  const keywords = typeof arg0 === 'string' ? [arg0] : arg0
  intenders.push({ command: this, keywords, callback })
}

export const name = 'nlp'

export function apply (ctx: Context, options: NlpConfig = {}) {
  options = { threshold: 0.5, ...options }

  ctx.middleware((meta, next) => {
    let confidence = options.threshold, bestFit: ParsedCommandLine
    for (const { keywords, callback, command } of intenders) {
      const keyword = keywords.find(k => meta.message.includes(k))
      if (keyword) {
        if (!meta.$tags) meta.$tags = tag(meta.message)
        const argv = callback(meta, keyword)
        if (argv.confidence > confidence) {
          confidence = argv.confidence
          bestFit = { meta, command, ...argv }
        }
      }
    }
    if (bestFit) {
      return bestFit.command.execute(bestFit, next)
    } else {
      return next()
    }
  })
}
