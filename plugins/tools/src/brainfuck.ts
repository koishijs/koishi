import { Context, segment } from 'koishi'

export interface BrainfuckOptions {
  cellSize?: number
  memorySize?: number
  maxSteps?: number
}

const defaultOptions: BrainfuckOptions = {
  cellSize: 8,
  memorySize: 1024,
  maxSteps: 16384,
}

class BFError extends Error {
  name: 'BFError'
}

class BrainFuck {
  options: Required<BrainfuckOptions>
  data = [0]
  pointer = 0
  mask: number
  map: Record<number, number> = {}

  constructor(public source: string, options: BrainfuckOptions = {}) {
    this.options = { ...defaultOptions, ...options } as any
    this.mask = (1 << this.options.cellSize) - 1
  }

  exec(input = '') {
    let output = ''
    let index = 0
    let step = 0
    while (index < this.source.length) {
      switch (this.source.charCodeAt(index)) {
        case 43: // '+'
          this.data[this.pointer] = ++this.data[this.pointer] & this.mask
          break

        case 45: // '-'
          this.data[this.pointer] = --this.data[this.pointer] & this.mask
          break

        case 62: // '>'
          if (++this.pointer >= this.options.memorySize) {
            throw new BFError('max memory exceed')
          }
          if (this.data[this.pointer] === undefined) {
            this.data[this.pointer] = 0
          }
          break

        case 60: // '<'
          if (!this.pointer) {
            throw new BFError('negative pointer')
          }
          --this.pointer
          break

        case 46: // '.'
          output += String.fromCharCode(this.data[this.pointer])
          break

        case 44: // ','
          this.data[this.pointer] = input.charCodeAt(0)
          input = input.slice(1)
          break

        case 91: { // '['
          const next = this.findMatch(index)
          if (!this.data[this.pointer]) {
            index = next
          }
          break
        }

        case 93: // ']'
          if (this.map[index] === undefined) {
            throw new BFError(`no matching "[" at position ${index}`)
          }
          if (this.data[this.pointer]) {
            index = this.map[index]
          }
      }

      ++index
      if (++step === this.options.maxSteps) {
        throw new BFError('max step exceeded')
      }
    }
    return output
  }

  findMatch(index: number) {
    let next = this.map[index]
    if (next) return next

    next = index + 1
    while (next < this.source.length && this.source.charCodeAt(next) !== 93) {
      if (this.source.charCodeAt(next) === 91) {
        next = this.findMatch(next)
      }
      ++next
    }

    if (next === this.source.length) {
      throw new BFError(`no matching "]" at position ${index}`)
    }
    this.map[next] = index
    return this.map[index] = next
  }
}

export const name = 'brainfuck'

export function apply(ctx: Context, config: BrainfuckOptions = {}) {
  ctx.command('tools/brainfuck <code>', '运行 brainfuck 代码')
    .alias('bf')
    .option('input', '-- <input:rawtext>  设置输入', { fallback: '' })
    .usage('语言介绍：http://www.muppetlabs.com/~breadbox/bf')
    .action(async ({ options }, source) => {
      if (!source) return '请输入源代码。'
      source = segment.unescape(source)
      const input = options.input
      try {
        return segment.escape(new BrainFuck(source, config).exec(input))
      } catch (error) {
        if (error.name === 'BFError') {
          return error.message
        }
      }
    })
}
