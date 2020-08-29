import { App, Command, CommandAction, Group, ParsedArgv, User } from 'koishi-core'
import { Logger, Observed, pick } from 'koishi-utils'
import { Worker, ResourceLimits } from 'worker_threads'
import { WorkerAPI, WorkerConfig, WorkerData, Response, ContextOptions } from './worker'
import { expose, Remote, wrap } from './transfer'
import { resolve } from 'path'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'worker/start'(): void | Promise<void>
    'worker/ready'(response: Response): void
    'worker/exit'(): void
  }
}

const logger = new Logger('eval')

export interface MainConfig extends FieldOptions {
  prefix?: string
  timeout?: number
  maxLogs?: number
  resourceLimits?: ResourceLimits
  dataKeys?: (keyof WorkerData)[]
}

export interface EvalConfig extends MainConfig, WorkerData {}

export interface Config extends MainConfig, WorkerConfig {}

export interface Trap<O extends {}, T = any, K extends keyof O = never> {
  fields: Iterable<K>
  get?(data: Pick<O, K>): T
  set?(data: Pick<O, K>, value: T): void
}

export class DataTrap<O extends {}> {
  private traps: Record<string, Trap<O, any, any>> = {}

  define<T, K extends keyof O = never>(key: string, trap: Trap<O, T, K>) {
    this.traps[key] = trap
  }

  * fields(fields: (string & keyof O)[] = []) {
    for (const field of fields) {
      const trap = this.traps[field]
      trap ? yield* trap.fields : yield field
    }
  }

  get(target: Observed<{}, Promise<void>>, fields: string[]) {
    if (!target) return
    const result: Partial<O> = {}
    for (const field of fields) {
      const getter = this.traps[field]?.get
      Reflect.set(result, field, getter ? getter(target) : target[field])
    }
    return result
  }

  set(target: Observed<{}, Promise<void>>, data: Partial<O>) {
    for (const field in data) {
      const setter = this.traps[field]?.set
      setter ? setter(target, data[field]) : Reflect.set(target, field, data[field])
    }
    return target._update()
  }
}

export const userTrap = new DataTrap<User>()
export const groupTrap = new DataTrap<Group>()

interface AccessOptions<T> {
  readable?: T[]
  writable?: T[]
}

export type Access<T> = T[] | AccessOptions<T>

interface TrappedArgv<O> extends ParsedArgv<never, never, O> {
  ctxOptions?: ContextOptions
}

type TrappedAction<O> = (argv: TrappedArgv<O>, ...args: string[]) => ReturnType<CommandAction>

function resolveAccess<T>(fields: Access<T>) {
  return Array.isArray(fields)
    ? { readable: fields, writable: [] }
    : { readable: [], writable: [], ...fields }
}

export interface FieldOptions {
  userFields?: Access<User.Field>
  groupFields?: Access<Group.Field>
}

export function attachTraps<O>(command: Command<never, never, O>, options: FieldOptions, action: TrappedAction<O>) {
  const userAccess = resolveAccess(options.userFields)
  const groupAccess = resolveAccess(options.groupFields)
  const userWritable = userAccess.writable
  const groupWritable = groupAccess.writable

  command.userFields(userTrap.fields(userAccess.readable))
  command.groupFields(groupTrap.fields(groupAccess.readable))
  command.action((argv, ...args) => {
    const { $uuid, $user, $group } = argv.session
    const user = userTrap.get($user, userAccess.readable)
    const group = groupTrap.get($group, groupAccess.readable)
    const ctxOptions = { $uuid, user, group, userWritable, groupWritable }
    return action({ ...argv, ctxOptions }, ...args)
  })
}

export class MainAPI {
  constructor(public app: App) {}

  private getSession(uuid: string) {
    const session = this.app._sessions[uuid]
    if (!session) throw new Error(`session ${uuid} not found`)
    return session
  }

  async execute(uuid: string, message: string) {
    const session = this.getSession(uuid)
    const send = session.$send
    const sendQueued = session.$sendQueued
    await session.$execute(message)
    session.$sendQueued = sendQueued
    session.$send = send
  }

  async send(uuid: string, message: string) {
    const session = this.getSession(uuid)
    if (!session._sendCount) session._sendCount = 0
    if (this.app.worker.config.maxLogs > session._sendCount++) {
      return await session.$sendQueued(message)
    }
  }

  async updateUser(uuid: string, data: Partial<User>) {
    const session = this.getSession(uuid)
    return userTrap.set(session.$user, data)
  }

  async updateGroup(uuid: string, data: Partial<Group>) {
    const session = this.getSession(uuid)
    return groupTrap.set(session.$group, data)
  }
}

export const workerScript = `require(${JSON.stringify(resolve(__dirname, 'worker.js'))});`

export class EvalWorker {
  static restart = true

  private worker: Worker
  private promise: Promise<void>

  public local: MainAPI
  public remote: Remote<WorkerAPI>

  constructor(public app: App, public config: EvalConfig) {
    this.local = new MainAPI(app)
  }

  async start() {
    await this.app.parallel('worker/start')

    this.worker = new Worker(workerScript, {
      eval: true,
      workerData: {
        logLevels: Logger.levels,
        ...pick(this.config, this.config.dataKeys),
      },
      resourceLimits: this.config.resourceLimits,
    })

    expose(this.worker, this.local)
    this.remote = wrap(this.worker)

    await this.remote.start().then((response) => {
      this.app.emit('worker/ready', response)
      logger.info('worker started')

      this.worker.on('exit', (code) => {
        this.app.emit('worker/exit')
        logger.info('exited with code', code)
        if (EvalWorker.restart) this.promise = this.start()
      })
    })
  }

  async restart() {
    await this.worker.terminate()
    await this.promise
  }

  onError(listener: (error: Error) => void) {
    this.worker.on('error', listener)
    return () => this.worker.off('error', listener)
  }
}

process.on('beforeExit', () => {
  EvalWorker.restart = false
})
