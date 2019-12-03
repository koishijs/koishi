import { fork } from 'child_process'
import { resolve } from 'path'
import { black } from 'chalk'
import CAC from 'cac/types/CAC'

function createWorker () {
  const child = fork(resolve(__dirname, 'worker'))
  let started = false
  child.on('message', (message) => {
    if (message === 'started') started = true
  })
  child.on('exit', (code) => {
    if (!code) {
      return console.log(`${black.bgCyanBright('  INFO  ')} Bot was stopped manually.`)
    } else if (code === 1) {
      if (started) {
        console.log(`${black.bgCyanBright('  WARN  ')} An error was encounted. Restarting...`)
      } else {
        return console.log(`${black.bgCyanBright('  ERROR  ')} A fatal error was encounted.`)
      }
    } else {
      console.log(`${black.bgCyanBright('  INFO  ')} Bot was restarted manually.`)
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
