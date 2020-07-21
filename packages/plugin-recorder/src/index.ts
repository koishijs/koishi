import { WriteStream, createWriteStream, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { Meta, Context } from 'koishi-core'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'before-record' (meta: Meta): any
  }
}

function pick <T, K extends keyof T> (source: T, keys: K[]): Pick<T, K> {
  return keys.reduce((prev, curr) => (prev[curr] = source[curr], prev), {} as Pick<T, K>)
}

const streams: Record<string, WriteStream> = {}

export interface RecorderOptions {
  folder?: string
}

const cwd = process.cwd()

export const name = 'recorder'

export function apply (ctx: Context, options: RecorderOptions = {}) {
  async function handleMessage (meta: Meta<never, 'assignee'>) {
    if (meta.$ctxType !== 'group' || meta.postType === 'message' && meta.$group.assignee !== ctx.app.selfId) return
    if (await ctx.serialize('before-record', meta)) return
    const output = JSON.stringify(pick(meta, ['time', 'userId', 'message'])) + '\n'
    const path = resolve(cwd, options.folder || 'messages', `${meta.groupId}.txt`)
    if (!streams[path]) {
      const folder = dirname(path)
      if (!existsSync(folder)) {
        mkdirSync(folder, { recursive: true })
      }
      streams[path] = createWriteStream(path, { flags: 'a' })
    }
    streams[path].write(output)
  }

  ctx.on('attach-group', (meta: Meta<never, 'assignee'>) => {
    handleMessage(meta)
  })

  ctx.on('before-send', (meta: Meta<never, 'assignee'>) => {
    handleMessage(meta)
  })
}
