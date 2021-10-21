import { Context, Schema, interpolate } from 'koishi'
import onebot from '@koishijs/plugin-adapter-onebot'
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

export const name = 'gocqhttp'

export const schema = Schema.object({})

const { dict } = onebot.schema.list[1].alt

dict['http'].dict['password'] = Schema.string('机器人的密码。')
dict['ws'].dict['password'] = Schema.string('机器人的密码。')
dict['ws-reverse'].dict['password'] = Schema.string('机器人的密码。')

async function prepare(bot: onebot.Bot) {
  if (bot.adapter.platform !== 'onebot') return
  const { port, host = 'localhost' } = bot.app.options
  const { path = '/onebot/' } = bot.app.registry.get(onebot).config
  const cwd = resolve('accounts/' + bot.selfId)
  await mkdir(cwd, { recursive: true })
  await copyFile(resolve(__dirname, '../bin/go-cqhttp'), cwd + '/go-cqhttp')
  const template = await readFile(resolve(__dirname, '../template.yml'), 'utf8')
  await writeFile(cwd + '/config.yml', interpolate(template, {
    bot: bot.config,
    adapter: bot.adapter.config,
    endpoint: bot.config.endpoint && new URL(bot.config.endpoint),
    selfUrl: `${host}:${port}${path}`,
  }, /\$\$(.+)/g))
  bot.process = spawn('./go-cqhttp', ['faststart'], { stdio: 'inherit', cwd })
}

export function apply(ctx: Context) {
  ctx.on('connect', () => {
    ctx.bots.forEach(prepare)

    ctx.on('bot-added', prepare)

    ctx.on('bot-removed', async (bot: onebot.Bot) => {
      if (bot.adapter.platform !== 'onebot') return
      bot.process?.kill()
    })
  })
}
