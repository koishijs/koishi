import { performance } from 'perf_hooks'
import { fork } from 'child_process'
import { resolve } from 'path'
import { logger } from './utils'
import CAC from 'cac/types/CAC'

process.env.KOISHI_START_TIME = '' + performance.now()

function createWorker () {
  const child = fork(resolve(__dirname, 'worker'))
  let started = false

  child.on('message', (data: any) => {
    if (data.type === 'start') {
      started = true
    } else if (data.type === 'error') {
      logger.error(data.message)
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
      logger.warning('an error was encounted. restarting...')
    }
    createWorker()
  })
}

export default function (cli: CAC) {
  cli.command('run [file]', 'start a koishi bot')
    .alias('start')
    .action((file, options) => {
      process.env.KOISHI_BASE_PATH = resolve(process.cwd(), file || '')
      createWorker()
    })
}
