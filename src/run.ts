import { CODE_RESTART } from 'koishi-plugin-common'
import { performance } from 'perf_hooks'
import { fork } from 'child_process'
import { resolve } from 'path'
import { black } from 'chalk'
import CAC from 'cac/types/CAC'

process.env.KOISHI_START_TIME = '' + performance.now()

function createWorker () {
  const child = fork(resolve(__dirname, 'worker'))
  let started = false
  child.on('message', (message) => {
    if (message === 'started') started = true
  })
  child.on('exit', (code) => {
    if (!code) {
      return console.log(`${black.bgCyanBright(' INFO ')} Bot was stopped manually.`)
    } else if (started) {
      if (code === CODE_RESTART) {
        console.log(`${black.bgCyanBright(' INFO ')} Bot was restarted manually.`)
      } else {
        console.log(`${black.bgYellowBright(' WARNING ')} An error was encounted. Restarting...`)
      }
    } else {
      return console.log(`${black.bgRedBright(' ERROR ')} A fatal error was encounted.`)
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
