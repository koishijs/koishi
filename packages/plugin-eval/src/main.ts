import { App, Command, CommandAction, ParsedArgv, User } from 'koishi-core'
import { Logger, pick } from 'koishi-utils'
import { resolve } from 'path'
import { WorkerAPI, WorkerConfig, WorkerData, Response } from './worker'
import { Worker, ResourceLimits } from 'worker_threads'
import { expose, Remote, wrap } from './transfer'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'worker/start'(): void | Promise<void>
    'worker/ready'(response: Response): void
    'worker/exit'(): void
  }
}

const logger = new Logger('eval')

export interface MainConfig {
  prefix?: string
  timeout?: number
  maxLogs?: number
  userFields?: Access<User.Field>
  resourceLimits?: ResourceLimits
  dataKeys?: (keyof WorkerData)[]
}

export interface EvalConfig extends MainConfig, WorkerData {}

export interface Config extends MainConfig, WorkerConfig {}

interface TrappedArgv<O> extends ParsedArgv<never, never, O> {
  user: Partial<User>
  writable: User.Field[]
}

type TrappedAction<O> = (argv: TrappedArgv<O>, ...args: string[]) => ReturnType<CommandAction>

export interface UserTrap<T = any, K extends User.Field = never> {
  fields: Iterable<K>
  get?(data: Pick<User, K>): T
  set?(data: Pick<User, K>, value: T): void
}

export namespace UserTrap {
  const traps: Record<string, UserTrap<any, any>> = {}

  export function define<T, K extends User.Field = never>(key: string, trap: UserTrap<T, K>) {
    traps[key] = trap
  }

  export function attach<O>(command: Command<never, never, O>, fields: Access<User.Field>, action: TrappedAction<O>) {
    const { readable = [], writable = [] } = Array.isArray(fields) ? { readable: fields } : fields
    for (const field of readable) {
      const trap = traps[field]
      command.userFields(trap ? trap.fields : [field])
      command.action((argv, ...args) => {
        const user = get(argv.session.$user, readable)
        return action({ ...argv, user, writable }, ...args)
      })
    }
  }

  export function get($user: User.Observed<never>, fields: string[]) {
    if (!$user) return {}
    const result: Partial<User> = {}
    for (const field of fields) {
      const getter = traps[field]?.get
      Reflect.set(result, field, getter ? getter($user) : $user[field])
    }
    return result
  }

  export function set($user: User.Observed<never>, data: Partial<User>) {
    for (const field in data) {
      const setter = traps[field]?.set
      setter ? setter($user, data[field]) : ($user[field] = data[field])
    }
    return $user._update()
  }
}

export type Access<T> = T[] | {
  readable?: T[]
  writable?: T[]
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
    return UserTrap.set(session.$user, data)
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
