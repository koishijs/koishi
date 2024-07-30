import { App } from 'koishi'
import * as help from '@koishijs/plugin-help'
import mock from '@koishijs/plugin-mock'
import memory from '@minatojs/driver-memory'

const app = new App({
  minSimilarity: 0.64,
})

app.plugin(mock)
app.plugin(help)
app.plugin(memory)

app.i18n.define('$zh-CN', 'commands.help.messages.global-epilog', 'EPILOG')

const client = app.mock.client('123', '456')

before(async () => {
  await app.start()
  await app.mock.initUser('123', 2)
  await app.mock.initChannel('456')
})

let message: string

describe('@koishijs/plugin-help', () => {
  it('basic support', async () => {
    await client.shouldReply('help', message = [
      '当前可用的指令有：',
      '    help  显示帮助信息',
      'EPILOG',
    ].join('\n'))

    // global shortcut
    await client.shouldReply('帮助', message)

    await client.shouldReply('help help', message = [
      '指令：help [command]',
      '显示帮助信息',
      '可用的选项有：',
      '    -H, --show-hidden  查看隐藏的选项和指令',
    ].join('\n'))

    await client.shouldReply('help xxxx', '指令未找到。')
    await client.shouldReply('help heip', '指令未找到。您要找的是不是“help”？回复句号以使用推测的指令。')
    await client.shouldReply('.', message)
    await client.shouldReply('help -h', message)
    await client.shouldReply('help 帮助', message)
  })

  it('command attributes', async () => {
    app.command('foo1', 'DESCRIPTION').alias('foo')
    app.command('foo3', 'DESCRIPTION').shortcut(/foobar/)
    app.command('foo4', 'DESCRIPTION').usage('USAGE TEXT')
    app.command('foo5', 'DESCRIPTION').usage(({ userId }) => '' + userId)
    app.command('foo6', 'DESCRIPTION').example('EXAMPLE TEXT')
    app.command('foo7', 'DESCRIPTION', { authority: 3 })

    await client.shouldReply('help foo1', '指令：foo1\nDESCRIPTION\n别名：foo。')
    await client.shouldReply('help foobar', '指令：foo3\nDESCRIPTION')
    await client.shouldReply('help foo4', '指令：foo4\nDESCRIPTION\nUSAGE TEXT')
    await client.shouldReply('help foo5', '指令：foo5\nDESCRIPTION\n123')
    await client.shouldReply('help foo6', '指令：foo6\nDESCRIPTION\n使用示例：\n    EXAMPLE TEXT')
    await client.shouldReply('help foo7', '权限不足。')
  })

  it('command options', async () => {
    const bar = app
      .command('bar <arg:number>', 'DESCRIPTION', { hideOptions: true })
      .option('opt1', '选项1', { authority: 2 })
      .option('opt1', '-n  选项2', { value: false })
      .option('opt2', '[arg:boolean]  选项3')
      .option('opt3', '-o [arg:boolean]', { hidden: true })

    await client.shouldReply('help bar', message = '指令：bar <arg>\nDESCRIPTION')

    bar.config.hideOptions = false

    await client.shouldReply('help bar', [
      message,
      '可用的选项有：',
      '    --opt1  选项1',
      '    -n  选项2',
      '    --opt2 [arg]  选项3',
    ].join('\n'))

    await client.shouldReply('help bar -H', [
      message,
      '可用的选项有：',
      '    -h, --help  显示此信息',
      '    --opt1  选项1',
      '    -n  选项2',
      '    --opt2 [arg]  选项3',
      '    -o, --opt3 [arg]',
    ].join('\n'))
  })

  it('subcommand', async () => {
    const foo2 = app.command('foo2', 'DESCRIPTION', { authority: 0 })
    const foo1 = foo2.subcommand('foo1')
    const foo3 = foo1.subcommand('foo3')

    await client.shouldReply('help foo2', [
      '指令：foo2',
      'DESCRIPTION',
      '可用的子指令有：',
      '    foo1  DESCRIPTION',
    ].join('\n'))

    await client.shouldReply('help foo1', [
      '指令：foo1',
      'DESCRIPTION',
      '别名：foo。',
      '可用的子指令有：',
      '    foo3  DESCRIPTION',
    ].join('\n'))
  })

  it('no database', async () => {
    const app = new App()
    app.plugin(help)
    app.plugin(mock)
    app.i18n.define('$zh-CN', 'commands.help.messages.global-epilog', '')
    await app.start()

    const client = app.mock.client('123')
    await client.shouldReply('help', '当前可用的指令有：\n    help  显示帮助信息')
  })

  it('disable help options', async () => {
    const app = new App()
    app.plugin(help, { options: false })
    app.plugin(mock)
    app.command('foo').action(() => {})
    await app.start()

    const client = app.mock.client('123')
    await client.shouldReply('help')
    await client.shouldNotReply('foo -h')
  })

  it('disable help shortcut', async () => {
    const app = new App()
    app.plugin(help, { shortcut: false })
    app.plugin(mock)
    await app.start()

    const client = app.mock.client('123')
    await client.shouldReply('help')
    await client.shouldNotReply('帮助')
  })

  it('checkArgCount (#769)', async () => {
    const app = new App()
    app.plugin(help)
    app.plugin(mock)
    app.command('test <arg>', { checkArgCount: true }).action(() => 'pass')
    await app.start()

    const client = app.mock.client('123')
    await client.shouldReply('test', '请发送arg。')
    await client.shouldReply('foo', 'pass')
    await client.shouldReply('test -h', '指令：test <arg>')
  })
})
