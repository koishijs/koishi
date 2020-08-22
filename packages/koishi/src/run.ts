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
  514, // preserved for koishi
]

let child: ChildProcess

process.on('SIGINT', () => {
  if (child) {
    child.emit('SIGINT')
  } else {
    process.exit()
  }
})

function createWorker(options: WorkerOptions) {
  child = fork(resolve(__dirname, 'worker'), [], {
    execArgv: options['--'],
  })

  let started = false

  child.on('message', (data) => {
    if (data === 'start') {
      started = true
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
  cli.command('run [file]', 'start a koishi bot')
    .alias('start')
    .option('--debug [namespace]', 'specify debug namespace')
    .option('--level [level]', 'specify log level (default: 2)')
    .action((file, options) => {
      const { level } = options
      if (level !== undefined && (!isInteger(level) || level < 0)) {
        console.warn(`${kleur.red('error')} log level should be a positive integer.`)
        process.exit(1)
      }
      process.env.KOISHI_LOG_LEVEL = level || ''
      process.env.KOISHI_DEBUG = options.debug || ''
      process.env.KOISHI_CONFIG_FILE = file || ''
      createWorker(options)
    })
}
