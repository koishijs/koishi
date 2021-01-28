import { App, Command, Channel, Argv, User } from 'koishi-core'
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
  authority?: number
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
export const channelTrap = new DataTrap<Channel>()

export interface AccessOptions<T> {
  readable?: T[]
  writable?: T[]
}

export type Access<T> = T[] | AccessOptions<T>

interface TrappedArgv<A extends any[], O> extends Argv<never, never, A, O> {
  ctxOptions?: ContextOptions
}

type TrappedAction<A extends any[], O> = (argv: TrappedArgv<A, O>, ...args: A) => ReturnType<Command.Action>

export function resolveAccess<T>(fields: Access<T>): AccessOptions<T> {
  return Array.isArray(fields)
    ? { readable: fields, writable: [] }
    : { readable: [], writable: [], ...fields }
}

export interface FieldOptions {
  userFields?: Access<User.Field>
  channelFields?: Access<Channel.Field>
}

export function attachTraps<A extends any[], O>(
  command: Command<never, never, A, O>,
  userAccess: AccessOptions<User.Field>,
  channelAccess: AccessOptions<Channel.Field>,
  action: TrappedAction<A, O>,
) {
  const userWritable = userAccess.writable
  const channelWritable = channelAccess.writable

  command.userFields([...userTrap.fields(userAccess.readable)])
  command.channelFields([...channelTrap.fields(channelAccess.readable)])
  command.action((argv, ...args) => {
    const { $uuid, $user, $channel } = argv.session
    const user = userTrap.get($user, userAccess.readable)
    const channel = channelTrap.get($channel, channelAccess.readable)
    const ctxOptions = { $uuid, user, channel, userWritable, channelWritable }
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
    const send = session.send
    const sendQueued = session.sendQueued
    await session.execute(message)
    session.sendQueued = sendQueued
    session.send = send
  }

  async send(uuid: string, message: string) {
    const session = this.getSession(uuid)
    if (!session._sendCount) session._sendCount = 0
    if (this.app.worker.config.maxLogs > session._sendCount++) {
      return await session.sendQueued(message)
    }
  }

  async updateUser(uuid: string, data: Partial<User>) {
    const session = this.getSession(uuid)
    return userTrap.set(session.$user, data)
  }

  async updateGroup(uuid: string, data: Partial<Channel>) {
    const session = this.getSession(uuid)
    return channelTrap.set(session.$channel, data)
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
