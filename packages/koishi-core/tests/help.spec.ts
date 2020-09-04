/* eslint-disable @typescript-eslint/no-unused-vars */

import { memory, App } from 'koishi-test-utils'
import { Time } from 'koishi-utils'
import { Message } from 'koishi-core'
import { install } from '@sinonjs/fake-timers'

Message.GLOBAL_HELP_EPILOG = 'EPILOG'

const app = new App().plugin(memory)
const session = app.createSession('user', 123)
const now = Date.now()

before(async () => {
  await app.database.getUser(123, 2)
  await app.database.setUser(123, {
    usage: { foo7: 1, $date: Time.getDateNumber() },
    timers: { foo8: now + Time.minute, $date: now + Time.day },
  })
})

let message: string

describe('Help Command', () => {
  it('basic support', async () => {
    await session.shouldHaveReply('help', [
      '当前可用的指令有：',
      '    help  显示帮助信息',
      'EPILOG',
    ].join('\n'))

    await session.shouldHaveReply('help help', message = [
      'help [command]',
      '显示帮助信息',
      '可用的选项有：',
      '    -a, --authority  显示权限设置',
      '    -H, --show-hidden  查看隐藏的选项和指令',
    ].join('\n'))

    await session.shouldHaveReply('help heip', '指令未找到。你要找的是不是“help”？发送空行或句号以调用推测的指令。')
    await session.shouldHaveReply('.', message)
    await session.shouldHaveReply('help -h', message)
  })

  it('command attributes', async () => {
    app.command('foo1', 'DESCRIPTION').alias('foo')
    app.command('foo2', 'DESCRIPTION', { authority: 2 })
    app.command('foo3', 'DESCRIPTION').before(() => true)
    app.command('foo4', 'DESCRIPTION').usage('USAGE TEXT')
    app.command('foo5', 'DESCRIPTION').usage(({ userId }) => '' + userId)
    app.command('foo6', 'DESCRIPTION').example('EXAMPLE TEXT')
    app.command('foo7', 'DESCRIPTION', { maxUsage: 3 })
    app.command('foo8', 'DESCRIPTION', { minInterval: 3 * Time.minute })
    app.command('foo9', 'DESCRIPTION', { minInterval: 3 * Time.minute })

    const clock = install({ now })

    await session.shouldHaveReply('help foo1', 'foo1\nDESCRIPTION\n别名：foo。')
    await session.shouldHaveReply('help foo2', 'foo2\nDESCRIPTION\n最低权限：2 级。')
    await session.shouldHaveReply('help foo3', 'foo3\nDESCRIPTION（指令已禁用）')
    await session.shouldHaveReply('help foo4', 'foo4\nDESCRIPTION\nUSAGE TEXT')
    await session.shouldHaveReply('help foo5', 'foo5\nDESCRIPTION\n123')
    await session.shouldHaveReply('help foo6', 'foo6\nDESCRIPTION\n使用示例：\n    EXAMPLE TEXT')
    await session.shouldHaveReply('help foo7', 'foo7\nDESCRIPTION\n已调用次数：1/3。')
    await session.shouldHaveReply('help foo8', 'foo8\nDESCRIPTION\n距离下次调用还需：60/180 秒。')
    await session.shouldHaveReply('help foo9', 'foo9\nDESCRIPTION\n距离下次调用还需：0/180 秒。')

    clock.uninstall()
  })

  it('command options', async () => {
    const bar = app
      .command('bar', 'DESCRIPTION', { maxUsage: 2, hideOptions: true })
      .option('opt1', '选项1', { authority: 2 })
      .option('opt2', '选项2', { notUsage: true })
      .option('opt3', '选项3', { hidden: true })

    await session.shouldHaveReply('help bar', message = 'bar\nDESCRIPTION\n已调用次数：0/2。')

    bar.config.hideOptions = false

    await session.shouldHaveReply('help bar', [
      message,
      '可用的选项有：',
      '    --opt1  选项1',
      '    --opt2  选项2（不计入总次数）',
    ].join('\n'))

    await session.shouldHaveReply('help bar -H', [
      message,
      '可用的选项有：',
      '    -h, --help  显示此信息',
      '    --opt1  选项1',
      '    --opt2  选项2（不计入总次数）',
      '    --opt3  选项3',
    ].join('\n'))

    await session.shouldHaveReply('help bar -a', [
      message,
      '可用的选项有（括号内为额外要求的权限等级）：',
      '    (2) --opt1  选项1',
      '    --opt2  选项2（不计入总次数）',
    ].join('\n'))
  })

  it('subcommand', async () => {
    const foo2 = app.command('foo2')
    delete foo2.config.authority
    const foo1 = foo2.subcommand('foo1')
    const foo3 = foo1.subcommand('foo3')

    await session.shouldHaveReply('help foo2', [
      'foo2',
      'DESCRIPTION',
      '可用的子指令有：',
      '    foo1  DESCRIPTION',
    ].join('\n'))

    await session.shouldHaveReply('help foo2 -a', [
      'foo2',
      'DESCRIPTION',
      '可用的子指令有（括号内为对应的最低权限等级，标有星号的表示含有子指令）：',
      '    foo1 (1*)  DESCRIPTION',
    ].join('\n'))

    await session.shouldHaveReply('help foo1 -a', [
      'foo1',
      'DESCRIPTION',
      '别名：foo。',
      '可用的子指令有（括号内为对应的最低权限等级）：',
      '    foo3 (1)  DESCRIPTION',
    ].join('\n'))
  })

  it('no database', async () => {
    Message.GLOBAL_HELP_EPILOG = ''

    const app = new App()
    const session = app.createSession('user', 123)
    await session.shouldHaveReply('help', '当前可用的指令有：\n    help  显示帮助信息')
  })
})
