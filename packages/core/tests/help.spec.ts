/* eslint-disable @typescript-eslint/no-unused-vars */

import { App, Time, template } from 'koishi'
import { install } from '@sinonjs/fake-timers'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'

template.set('internal.global-help-epilog', 'EPILOG')

const app = new App().plugin(mock).plugin(memory)
const client = app.mock.client('123')
const now = Date.now()

before(async () => {
  await app.mock.initUser('123', 2)
  await app.database.setUser('mock', '123', {
    usage: { foo7: 1, $date: Time.getDateNumber() },
    timers: { foo8: now + Time.minute, $date: now + Time.day },
  })
})

let message: string

describe('Help Command', () => {
  it('basic support', async () => {
    await client.shouldReply('help', message = [
      '当前可用的指令有：',
      '    help  显示帮助信息',
      'EPILOG',
    ].join('\n'))

    // global shortcut
    await client.shouldReply('帮助', message)

    await client.shouldReply('help help', message = [
      'help [command]',
      '显示帮助信息',
      '可用的选项有：',
      '    -a, --authority  显示权限设置',
      '    -H, --show-hidden  查看隐藏的选项和指令',
    ].join('\n'))

    await client.shouldReply('help heip', '指令未找到。您要找的是不是“help”？发送空行或句号以使用推测的指令。')
    await client.shouldReply('.', message)
    await client.shouldReply('help -h', message)
  })

  it('command attributes', async () => {
    app.command('foo1', 'DESCRIPTION').alias('foo')
    app.command('foo2', 'DESCRIPTION', { authority: 2 })
    app.command('foo3', 'DESCRIPTION').shortcut(/foobar/)
    app.command('foo4', 'DESCRIPTION').usage('USAGE TEXT')
    app.command('foo5', 'DESCRIPTION').usage(({ userId }) => '' + userId)
    app.command('foo6', 'DESCRIPTION').example('EXAMPLE TEXT')
    app.command('foo7', 'DESCRIPTION', { maxUsage: 3 })
    app.command('foo8', 'DESCRIPTION', { minInterval: 3 * Time.minute })
    app.command('foo9', 'DESCRIPTION', { minInterval: 3 * Time.minute })

    const clock = install({ now })

    await client.shouldReply('help foo1', 'foo1\nDESCRIPTION\n别名：foo。')
    await client.shouldReply('help foo2', 'foo2\nDESCRIPTION\n最低权限：2 级。')
    await client.shouldReply('help foobar', 'foo3\nDESCRIPTION')
    await client.shouldReply('help foo4', 'foo4\nDESCRIPTION\nUSAGE TEXT')
    await client.shouldReply('help foo5', 'foo5\nDESCRIPTION\n123')
    await client.shouldReply('help foo6', 'foo6\nDESCRIPTION\n使用示例：\n    EXAMPLE TEXT')
    await client.shouldReply('help foo7', 'foo7\nDESCRIPTION\n已调用次数：1/3。')
    await client.shouldReply('help foo8', 'foo8\nDESCRIPTION\n距离下次调用还需：60/180 秒。')
    await client.shouldReply('help foo9', 'foo9\nDESCRIPTION\n距离下次调用还需：0/180 秒。')

    clock.uninstall()
  })

  it('command options', async () => {
    const bar = app
      .command('bar <arg:number>', 'DESCRIPTION', { maxUsage: 2, hideOptions: true })
      .option('opt1', '选项1', { authority: 2 })
      .option('opt2', '选项2', { notUsage: true })
      .option('opt3', '[arg:boolean]  选项3', { hidden: true })
      .option('opt4', '-o [arg:boolean]', { hidden: true })

    await client.shouldReply('help bar', message = 'bar <arg>\nDESCRIPTION\n已调用次数：0/2。')

    bar.config.hideOptions = false

    await client.shouldReply('help bar', [
      message,
      '可用的选项有：',
      '    --opt1  选项1',
      '    --opt2  选项2（不计入总次数）',
    ].join('\n'))

    await client.shouldReply('help bar -H', [
      message,
      '可用的选项有：',
      '    -h, --help  显示此信息',
      '    --opt1  选项1',
      '    --opt2  选项2（不计入总次数）',
      '    --opt3 [arg]  选项3',
      '    -o, --opt4 [arg]',
    ].join('\n'))

    await client.shouldReply('help bar -a', [
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

    await client.shouldReply('help foo2', [
      'foo2',
      'DESCRIPTION',
      '可用的子指令有：',
      '    foo1  DESCRIPTION',
    ].join('\n'))

    await client.shouldReply('help foo2 -a', [
      'foo2',
      'DESCRIPTION',
      '可用的子指令有（括号内为对应的最低权限等级，标有星号的表示含有子指令）：',
      '    foo1 (1*)  DESCRIPTION',
    ].join('\n'))

    await client.shouldReply('help foo1 -a', [
      'foo1',
      'DESCRIPTION',
      '别名：foo。',
      '可用的子指令有（括号内为对应的最低权限等级）：',
      '    foo3 (1)  DESCRIPTION',
    ].join('\n'))
  })

  it('no database', async () => {
    template.set('internal.global-help-epilog', '')

    const app = new App().plugin(mock)
    const session = app.mock.client('123')
    await session.shouldReply('help', '当前可用的指令有：\n    help  显示帮助信息')
  })

  it('disable help command', async () => {
    const app = new App({ help: false }).plugin(mock)
    app.command('foo')
    const session = app.mock.client('123')
    await session.shouldNotReply('help')
    await session.shouldNotReply('foo -h')
  })

  it('disable help options', async () => {
    const app = new App({ help: { options: false } }).plugin(mock)
    app.command('foo')
    const session = app.mock.client('123')
    await session.shouldReply('help')
    await session.shouldNotReply('foo -h')
  })

  it('disable help shortcut', async () => {
    const app = new App({ help: { shortcut: false } }).plugin(mock)
    const session = app.mock.client('123')
    await session.shouldReply('help')
    await session.shouldNotReply('帮助')
  })
})
