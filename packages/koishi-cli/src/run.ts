import { performance } from 'perf_hooks'
import { isInteger } from 'koishi-utils'
import { fork } from 'child_process'
import { resolve } from 'path'
import { CAC } from 'cac'
import kleur from 'kleur'

process.env.KOISHI_START_TIME = '' + performance.now()

interface WorkerOptions {
  '--'?: string[]
}

function createWorker (options: WorkerOptions) {
  const child = fork(resolve(__dirname, 'worker'), [], {
    execArgv: options['--'],
  })

  child.on('exit', (code) => {
    if (code >= 0) process.exit(code)
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
