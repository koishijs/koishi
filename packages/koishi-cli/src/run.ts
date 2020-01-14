import { performance } from 'perf_hooks'
import { isInteger } from 'koishi-utils'
import { fork } from 'child_process'
import { resolve } from 'path'
import { logger } from './utils'
import CAC from 'cac/types/CAC'

process.env.KOISHI_START_TIME = '' + performance.now()

interface WorkerOptions {
  '--'?: string[]
}

function createWorker (options: WorkerOptions) {
  const child = fork(resolve(__dirname, 'worker'), [], {
    execArgv: options['--'],
  })
  let started = false

  child.on('message', (data: any) => {
    if (data.type === 'start') {
      started = true
    }
  })

  child.on('exit', (code) => {
    if (!started) process.exit(1)
    if (!code) {
      logger.info('bot was stopped manually.')
      process.exit(0)
    }
    if (code === 1) {
      logger.info('bot was restarted manually.')
    } else {
      logger.warn('an error was encounted. restarting...')
    }
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
          logger.error('log level should be a positive integer.')
          process.exit(1)
        }
        process.env.KOISHI_LOG_LEVEL = '' + logLevel
      }
      process.env.KOISHI_CONFIG_FILE = file || ''
      createWorker(options)
    })
}
