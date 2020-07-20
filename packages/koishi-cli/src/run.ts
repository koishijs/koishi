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
    .option('--log-level <level>', 'specify log level (default: 2)')
    .option('--silent', 'use log level 0 (print no message)')
    .option('--debug', 'use log level 3 (print all messages)')
    .action((file, options) => {
      let logLevel = options.logLevel
      if (options.silent) logLevel = 0
      if (options.debug) logLevel = 3
      if (logLevel !== undefined) {
        if (!isInteger(logLevel) || logLevel < 0) {
          console.warn(`${kleur.red('error')} log level should be a positive integer.`)
          process.exit(1)
        }
        process.env.KOISHI_LOG_LEVEL = '' + logLevel
      }
      process.env.KOISHI_CONFIG_FILE = file || ''
      createWorker(options)
    })
}
