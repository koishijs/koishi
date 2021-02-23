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

export default function (cli: CAC) {
  cli.command('start [file]', 'start a koishi bot')
    .alias('run')
    .option('--debug [namespace]', 'specify debug namespace')
    .option('--level [level]', 'specify log level (default: 2)')
    .option('--watch [path]', 'watch and reload at change')
    .action((file, options) => {
      const { level } = options
      if (level !== undefined && (!isInteger(level) || level < 0)) {
        console.warn(`${kleur.red('error')} log level should be a positive integer.`)
        process.exit(1)
      }
      process.env.KOISHI_LOG_LEVEL = level || ''
      process.env.KOISHI_DEBUG = options.debug || ''
      process.env.KOISHI_CONFIG_FILE = file || ''
      if (options.watch === true) {
        process.env.KOISHI_WATCH_ROOT = ''
      } else if (options.watch) {
        process.env.KOISHI_WATCH_ROOT = options.watch
      }
      createWorker(options)
    })
}
