import { App, Command, Channel, Argv as IArgv, User } from 'koishi-core'
import { Logger, Observed, pick, union } from 'koishi-utils'
import { Worker, ResourceLimits } from 'worker_threads'
import { WorkerAPI, WorkerConfig, WorkerData, WorkerResponse, ScopeData } from './worker'
import { expose, Remote, wrap } from './transfer'
import { resolve } from 'path'

declare module 'koishi-core' {
  interface EventMap {
    'worker/start'(): void | Promise<void>
    'worker/ready'(response: WorkerResponse): void
    'worker/exit'(): void
  }
}

const logger = new Logger('eval')

export interface MainConfig extends Trap.Config {
  prefix?: string
  authority?: number
  timeout?: number
  maxLogs?: number
  resourceLimits?: ResourceLimits
  dataKeys?: (keyof WorkerData)[]
  gitRemote?: string
  exclude?: RegExp
}

export interface EvalConfig extends MainConfig, WorkerData {}

export interface Config extends MainConfig, WorkerConfig {}

export class Trap<O extends {}> {
  private traps: Record<string, Trap.Declaraion<O, any, any>> = {}

  define<T, K extends keyof O = never>(key: string, trap: Trap.Declaraion<O, T, K>) {
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

export namespace Trap {
  export interface Declaraion<O extends {}, T = any, K extends keyof O = never> {
    fields: Iterable<K>
    get?(data: Pick<O, K>): T
    set?(data: Pick<O, K>, value: T): void
  }

  export const user = new Trap<User>()
  export const channel = new Trap<Channel>()

  export interface AccessObject<T> {
    readable?: T[]
    writable?: T[]
  }

  export type Access<T> = T[] | AccessObject<T>

  interface Argv<A extends any[], O> extends IArgv<never, never, A, O> {
    scope?: ScopeData
  }

  type Action<A extends any[], O> = (argv: Argv<A, O>, ...args: A) => ReturnType<Command.Action>

  export function resolve<T>(fields: Access<T>): AccessObject<T> {
    return Array.isArray(fields)
      ? { readable: fields, writable: [] }
      : { readable: [], writable: [], ...fields }
  }

  export function merge<T>(baseAccess: AccessObject<T>, fields: Access<T>): AccessObject<T> {
    const { readable: r1, writable: w1 } = baseAccess
    const { readable: r2, writable: w2 } = resolve(fields)
    return { readable: union(r1, r2), writable: union(w1, w2) }
  }

  export interface Config {
    userFields?: Access<User.Field>
    channelFields?: Access<Channel.Field>
  }

  export function action<A extends any[], O>(
    command: Command<never, never, A, O>,
    userAccess: AccessObject<User.Field>,
    channelAccess: AccessObject<Channel.Field>,
    action: Action<A, O>,
  ) {
    const userWritable = userAccess.writable
    const channelWritable = channelAccess.writable

    command.userFields([...Trap.user.fields(userAccess.readable)])
    command.channelFields([...Trap.channel.fields(channelAccess.readable)])
    command.action((argv, ...args) => {
      const { id } = argv.session
      const user = Trap.user.get(argv.session.user, userAccess.readable)
      const channel = Trap.channel.get(argv.session.channel, channelAccess.readable)
      const ctxOptions = { id, user, channel, userWritable, channelWritable }
      return action({ ...argv, scope: ctxOptions }, ...args)
    })
  }
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
    const result = await session.execute(message, true)
    session.sendQueued = sendQueued
    session.send = send
    return result
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
    return Trap.user.set(session.user, data)
  }

  async updateGroup(uuid: string, data: Partial<Channel>) {
    const session = this.getSession(uuid)
    return Trap.channel.set(session.channel, data)
  }
}

function createRequire(filename: string) {
  return `require(${JSON.stringify(filename)});\n`
}

enum State { closing, close, opening, open }

export class EvalWorker {
  private prevent = false
  private worker: Worker
  private promise: Promise<void>

  public state = State.close
  public local: MainAPI
  public remote: Remote<WorkerAPI>

  static readonly State = State

  constructor(public app: App, public config: EvalConfig) {
    this.local = new MainAPI(app)
  }

  async start() {
    this.state = State.opening
    await this.app.parallel('worker/start')
    process.on('beforeExit', this.beforeExit)

    let index = 0
    let workerScript = createRequire(resolve(__dirname, 'worker'))
    while (index < process.execArgv.length) {
      const arg = process.execArgv[index++]
      if (arg === '-r' || arg === '--require') {
        workerScript = createRequire(process.execArgv[index++]) + workerScript
      }
    }

    this.worker = new Worker(workerScript, {
      eval: true,
      workerData: {
        logLevels: Logger.levels,
        logTime: Logger.showTime,
        ...pick(this.config, this.config.dataKeys),
      },
      resourceLimits: this.config.resourceLimits,
    })

    expose(this.worker, this.local)
    this.remote = wrap(this.worker)

    await this.remote.start().then((response) => {
      this.app.emit('worker/ready', response)
      logger.debug('worker started')
      this.state = State.open

      this.worker.on('exit', (code) => {
        this.state = State.close
        this.app.emit('worker/exit')
        logger.debug('exited with code', code)
        if (!this.prevent) this.promise = this.start()
      })
    })
  }

  private beforeExit = () => {
    this.prevent = true
  }

  async stop() {
    this.state = State.closing
    this.beforeExit()
    process.off('beforeExit', this.beforeExit)
    await this.worker?.terminate()
  }

  async restart() {
    this.state = State.closing
    await this.worker?.terminate()
    await this.promise
  }

  onError(listener: (error: Error) => void) {
    this.worker.on('error', listener)
    return () => this.worker.off('error', listener)
  }
}
