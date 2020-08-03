import { WriteStream, createWriteStream, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { Session, Context } from 'koishi-core'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'before-record' (session: Session): any
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
  async function handleMessage (session: Session<never, 'assignee'>) {
    if (session.$ctxType !== 'group' || session.postType === 'message' && session.$group.assignee !== session.selfId) return
    if (await ctx.serialize('before-record', session)) return
    const output = JSON.stringify(pick(session, ['time', 'userId', 'message'])) + '\n'
    const path = resolve(cwd, options.folder || 'messages', `${session.groupId}.txt`)
    if (!streams[path]) {
      const folder = dirname(path)
      if (!existsSync(folder)) {
        mkdirSync(folder, { recursive: true })
      }
      streams[path] = createWriteStream(path, { flags: 'a' })
    }
    streams[path].write(output)
  }

  ctx.on('attach-group', (session: Session<never, 'assignee'>) => {
    handleMessage(session)
  })

  ctx.on('before-send', (session: Session<never, 'assignee'>) => {
    handleMessage(session)
  })
}
