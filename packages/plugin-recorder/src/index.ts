import { Context, Meta, onStop } from 'koishi-core'
import { WriteStream, createWriteStream, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'record-opened' (stream: WriteStream, path: string): any
    'record-closing' (stream: WriteStream, path: string): any
    'record-writing' (chunk: string, meta: Meta): any
    'record-written' (chunk: string, meta: Meta): any
  }
}

function pick <T, K extends keyof T> (source: T, keys: K[]): Pick<T, K> {
  return keys.reduce((prev, curr) => (prev[curr] = source[curr], prev), {} as Pick<T, K>)
}

export interface RecorderOptions {
  transform? (meta: Meta): string
  target? (meta: Meta): string | void
}

const refs = new WeakSet<Meta>()

const defaultOptions: RecorderOptions = {
  target (meta) {
    if (refs.has(meta) || meta.$ctxType !== 'group') return
    return `messages/${meta.groupId}.txt`
  },
  transform (meta) {
    refs.add(meta)
    return JSON.stringify(pick(meta, ['$ctxType', '$ctxId', 'userId', 'message']))
  },
}

const streams: Record<string, WriteStream> = {}

export function apply (ctx: Context, options: RecorderOptions = {}) {
  options = { ...defaultOptions, ...options }

  function handleMessage (meta: Meta) {
    const target = options.target(meta)
    if (!target) return
    const output = options.transform(meta) + '\n'
    const path = resolve(process.cwd(), target)
    if (!streams[path]) {
      const folder = dirname(path)
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
      streams[path] = createWriteStream(path, { flags: 'a' })
      streams[path].on('close', () => delete streams[path])
      ctx.app.receiver.emit('record-opened', streams[path], path)
    }
    ctx.app.receiver.emit('record-writing', output, meta)
    streams[path].write(output, () => {
      ctx.app.receiver.emit('record-written', output, meta)
    })
  }

  onStop(() => {
    for (const key in streams) {
      ctx.app.receiver.emit('record-closing', streams[key], key)
      streams[key].close()
    }
  })

  ctx.receiver.on('message', handleMessage)
  ctx.receiver.on('before-send', handleMessage)
}
