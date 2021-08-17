import { performance } from 'perf_hooks'
import { isInteger } from '../node'
import { fork, ChildProcess } from 'child_process'
import { resolve } from 'path'
import { CAC } from 'cac'
import kleur from 'kleur'

process.env.KOISHI_START_TIME = '' + performance.now()

interface WorkerOptions {
  '--'?: string[]
}

let child: ChildProcess

process.on('SIGINT', () => {
  if (child) {
    child.emit('SIGINT')
  } else {
    process.exit()
  }
})

interface Message {
  type: 'start' | 'queue'
  body: any
}

let buffer = null

function createWorker(options: WorkerOptions) {
  child = fork(resolve(__dirname, 'worker'), [], {
    execArgv: options['--'],
  })

  let config: { autoRestart: boolean }

  child.on('message', (message: Message) => {
    if (message.type === 'start') {
      config = message.body
      if (buffer) {
        child.send({ type: 'send', body: buffer })
        buffer = null
      }
    } else if (message.type === 'queue') {
      buffer = message.body
    }
  })

  /**
   * https://tldp.org/LDP/abs/html/exitcodes.html
   * - 0: exit manually
   * - 130: SIGINT
   * - 137: SIGKILL
   * - **114: exit and restart (Koishi)**
   */
  const closingCode = [0, 130, 137]

  child.on('exit', (code) => {
    if (!config || closingCode.includes(code) || code !== 114 && !config.autoRestart) {
      process.exit(code)
    }
    createWorker(options)
  })
}

function setEnvArg(name: string, value: string | boolean) {
  if (value === true) {
    process.env[name] = ''
  } else if (value) {
    process.env[name] = value
  }
}

export default function (cli: CAC) {
  cli.command('start [file]', 'start a koishi bot')
    .alias('run')
    .option('--debug [namespace]', 'specify debug namespace')
    .option('--log-level [level]', 'specify log level (default: 2)')
    .option('--log-time [format]', 'show timestamp in logs')
    .option('--watch [path]', 'watch and reload at change')
    .action((file, options) => {
      const { logLevel } = options
      if (logLevel !== undefined && (!isInteger(logLevel) || logLevel < 0)) {
        console.warn(`${kleur.red('error')} log level should be a positive integer.`)
        process.exit(1)
      }
      setEnvArg('KOISHI_WATCH_ROOT', options.watch)
      setEnvArg('KOISHI_LOG_TIME', options.logTime)
      process.env.KOISHI_LOG_LEVEL = logLevel || ''
      process.env.KOISHI_DEBUG = options.debug || ''
      process.env.KOISHI_CONFIG_FILE = file || ''
      createWorker(options)
    })
}
