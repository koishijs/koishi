import { Dict, hyphenate, isInteger } from '@koishijs/utils'
import { ChildProcess, fork } from 'child_process'
import { resolve } from 'path'
import { CAC } from 'cac'
import type { Config } from '../worker/daemon'
import kleur from 'kleur'

type Event = Event.Start | Event.Env | Event.Heartbeat

namespace Event {
  export interface Start {
    type: 'start'
    body: Config
  }

  export interface Env {
    type: 'shared'
    body: string
  }

  export interface Heartbeat {
    type: 'heartbeat'
  }
}

let child: ChildProcess

process.env.KOISHI_SHARED = '{}'

function toArg(key: string) {
  return key.length === 1 ? `-${key}` : `--${hyphenate(key)}`
}

function createWorker(options: Dict<any>) {
  const execArgv = Object.entries(options).flatMap<string>(([key, value]) => {
    if (key === '--') return []
    key = toArg(key)
    if (value === true) {
      return [key]
    } else if (value === false) {
      return ['--no-' + key.slice(2)]
    } else if (Array.isArray(value)) {
      return value.flatMap(value => [key, value])
    } else {
      return [key, value]
    }
  })
  execArgv.push(...options['--'])

  child = fork(resolve(__dirname, '../worker'), [], {
    execArgv,
  })

  let config: Config
  let timer: NodeJS.Timeout

  child.on('message', (message: Event) => {
    if (message.type === 'start') {
      config = message.body
      timer = config.heartbeatTimeout && setTimeout(() => {
        console.log(kleur.red('daemon: heartbeat timeout'))
        child.kill('SIGKILL')
      }, config.heartbeatTimeout)
    } else if (message.type === 'shared') {
      process.env.KOISHI_SHARED = message.body
    } else if (message.type === 'heartbeat') {
      if (timer) timer.refresh()
    }
  })

  function shouldExit(code: number) {
    // start failed
    if (!config) return true

    // exit manually or by signal
    // https://tldp.org/LDP/abs/html/exitcodes.html
    if (code === 0 || code >= 128 && code < 128 + 16) return true

    // restart manually
    if (code === 51) return false
    if (code === 52) return true

    // fallback to autoRestart
    return !config.autoRestart
  }

  child.on('exit', (code) => {
    if (shouldExit(code)) {
      process.exit(code)
    }
    createWorker(options)
  })
}

function setEnvArg(name: string, value: string | boolean, toJson = false) {
  if (value === true) {
    process.env[name] = toJson ? '""' : ''
  } else if (value) {
    process.env[name] = toJson ? JSON.stringify(value) : value
  }
}

export default function (cli: CAC) {
  cli.command('start [file]', 'start a koishi bot')
    .alias('run')
    .allowUnknownOptions()
    .option('--debug [namespace]', 'specify debug namespace')
    .option('--log-level [level]', 'specify log level (default: 2)')
    .option('--log-time [format]', 'show timestamp in logs')
    .option('--watch [path]', 'watch and reload at change')
    .action((file, options) => {
      const { logLevel, debug, logTime, watch, ...rest } = options
      if (logLevel !== undefined && (!isInteger(logLevel) || logLevel < 0)) {
        console.warn(`${kleur.red('error')} log level should be a positive integer.`)
        process.exit(1)
      }
      setEnvArg('KOISHI_WATCH_ROOT', watch) // for backward compatibility
      setEnvArg('KOISHI_WATCH', watch, true)
      setEnvArg('KOISHI_LOG_TIME', logTime)
      process.env.KOISHI_LOG_LEVEL = logLevel || ''
      process.env.KOISHI_DEBUG = debug || ''
      process.env.KOISHI_CONFIG_FILE = file || ''
      createWorker(rest)
    })
}
