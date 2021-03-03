import { performance } from 'perf_hooks'
import { isInteger } from 'koishi-utils'
import { fork, ChildProcess } from 'child_process'
import { resolve } from 'path'
import { CAC } from 'cac'
import kleur from 'kleur'

process.env.KOISHI_START_TIME = '' + performance.now()

interface WorkerOptions {
  '--'?: string[]
}

const codes = [
  134, // heap out of memory
  114, // preserved for koishi
]

let child: ChildProcess

process.on('SIGINT', () => {
  if (child) {
    child.emit('SIGINT')
  } else {
    process.exit()
  }
})

interface Message {
  type: 'start' | 'exit'
  payload: any
}

let payload: any

function createWorker(options: WorkerOptions) {
  child = fork(resolve(__dirname, 'worker'), [], {
    execArgv: options['--'],
  })

  let started = false

  child.on('message', (message: Message) => {
    if (message.type === 'start') {
      started = true
      if (payload) {
        child.send({ type: 'send', payload })
      }
    } else if (message.type === 'exit') {
      payload = message.payload
    }
  })

  child.on('exit', (code) => {
    if (!started || !codes.includes(code)) {
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
