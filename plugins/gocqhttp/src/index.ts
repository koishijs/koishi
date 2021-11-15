import { Context, Schema, interpolate, Logger } from 'koishi'
import onebot, { OneBotBot } from '@koishijs/plugin-adapter-onebot'
import { spawn } from 'cross-spawn'
import { ChildProcess } from 'child_process'
import { resolve } from 'path'
import { mkdir, copyFile, readFile, writeFile } from 'fs/promises'
import { URL } from 'url'

declare module '@koishijs/plugin-adapter-onebot/lib/bot' {
  interface BotConfig {
    password?: string
  }

  interface OneBotBot {
    process: ChildProcess
  }
}

export const logger = new Logger('gocqhttp')

export interface Config {}

export const Config = Schema.object({})

const { dict } = onebot.Config.list[1].alt

dict['http'].dict['password'] = Schema.string('机器人的密码。')
dict['ws'].dict['password'] = Schema.string('机器人的密码。')
dict['ws-reverse'].dict['password'] = Schema.string('机器人的密码。')

const logLevelMap = {
  DEBUG: 'debug',
  INFO: 'debug',
  WARNING: 'warn',
  ERROR: 'error',
}

async function start(bot: OneBotBot) {
  // create working folder
  const cwd = resolve('accounts/' + bot.selfId)
  await mkdir(cwd, { recursive: true })
  await copyFile(resolve(__dirname, '../bin/go-cqhttp'), cwd + '/go-cqhttp')

  // create config.yml
  const { port, host = 'localhost' } = bot.app.options
  const { path = '/onebot' } = bot.app.registry.get(onebot).config
  const template = await readFile(resolve(__dirname, '../template.yml'), 'utf8')
  await writeFile(cwd + '/config.yml', interpolate(template, {
    bot: bot.config,
    adapter: bot.adapter.config,
    endpoint: bot.config.endpoint && new URL(bot.config.endpoint),
    selfUrl: `${host}:${port}${path}`,
  }, /<<(.+?)>>/g))

  // spawn go-cqhttp process
  bot.process = spawn('./go-cqhttp', ['faststart'], { cwd })
  return new Promise<void>((resolve, reject) => {
    bot.process.stderr.on('data', (data) => {
      data = data.toString().trim()
      if (!data) return
      for (const line of data.split('\n')) {
        const text = line.slice(23)
        const [type] = text.split(']: ', 1)
        if (type in logLevelMap) {
          logger[logLevelMap[type]](text.slice(type.length + 3))
        } else {
          logger.info(line.trim())
        }
        if (text.includes('アトリは、高性能ですから')) resolve()
      }
    })
    bot.process.on('exit', reject)
  })
}

export interface Config {
  logLevel?: number
}

export function apply(ctx: Context, config: Config = {}) {
  logger.level = config.logLevel || 2

  ctx.on('bot-connect', async (bot: OneBotBot) => {
    if (bot.adapter.platform !== 'onebot') return
    return start(bot)
  })

  ctx.on('bot-dispose', async (bot: OneBotBot) => {
    if (bot.adapter.platform !== 'onebot') return
    bot.process?.kill()
  })
}
