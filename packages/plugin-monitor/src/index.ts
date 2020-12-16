import { Context } from 'koishi-core'
import { observe, Logger } from 'koishi-utils'
import { Monitor, INTERVAL } from './monitor'
import './database'

export * from './database'
export * from './monitor'

const monitors: Record<number | string, Monitor> = {}
const logger = new Logger('monitor')

export const name = 'monitor'

export function apply(ctx: Context) {
  ctx = ctx.group()

  ctx.on('connect', async () => {
    const groups = await ctx.database.getChannelList(['subscribe'])
    const idSet = new Set<number>()
    for (const { subscribe } of groups) {
      for (const uid in subscribe) {
        idSet.add(Number(uid))
      }
    }

    const subscribes = await ctx.database.getSubscribes(Array.from(idSet))
    subscribes.forEach((subscribe, index) => {
      const monitor = monitors[subscribe.id] = new Monitor(subscribe, ctx.app)
      setTimeout(() => monitor.start(), index * INTERVAL / subscribes.length)
    })
  })

  async function checkNames(names: string[]) {
    const accounts = await ctx.database.findSubscribe(names, ['names'])
    if (!accounts.length) return []
    const usedNames: string[] = []
    for (const name of names) {
      for (const { names } of accounts) {
        if (names.includes(name)) {
          usedNames.push(name)
          break
        }
      }
    }
    return usedNames
  }

  const cmd = ctx.command('monitor', '直播监测器')

  cmd.subcommand('.create <...names>', '添加新的监测账号', { authority: 3 })
    .option('bilibili', '-b <id>  设置 Bilibili 账号')
    .option('mirrativ', '-m <id>  设置 Mirrativ 账号')
    .option('twitcasting', '-t <id>  设置 TwitCasting 账号', { type: 'string' })
    .action(async ({ options }, ...names) => {
      if (!names.length) return '请提供至少一个名字。'

      const usedNames = await checkNames(names)
      if (usedNames.length) return `名称 ${usedNames.join(', ')} 已被使用。`

      const { bilibili, twitcasting, mirrativ } = options
      if (!bilibili && !twitcasting && !mirrativ) return '请提供至少一种社交账号。'
      try {
        await ctx.database.createSubscribe({ names, bilibili, twitcasting, mirrativ })
        return '账号添加成功。'
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          return '已有此账号。'
        } else {
          return '无法账号此账号。'
        }
      }
    })

  cmd.subcommand('.search <name>', '查找账号信息')
    .alias('搜索主播')
    .action(async (_, name: string) => {
      if (!name) return '请输入账号。'
      name = String(name)
      const subscribe = await ctx.database.findSubscribe(name, ['names', 'bilibili', 'mirrativ', 'twitcasting'])
      if (!subscribe) return '没有找到该账号。'
      const { names, bilibili, twitcasting } = subscribe
      const output: string[] = [names[0]]
      if (names.length > 1) output[0] += ` (${names.slice(1).join(', ')})`
      if (bilibili) output.push('Bilibili: ' + bilibili)
      if (twitcasting) output.push('TwitCasting: ' + twitcasting)
      return output.join('\n')
    })

  cmd.subcommand('.remove <name>', '删除已有的检测账号', { authority: 3 })
    .action(async (_, name) => {
      if (!name) return '请输入账号。'
      name = String(name)
      const succeed = await ctx.database.removeSubscribe(name)
      if (succeed) return `已成功删除名为“${name}”的账号。`
      return `未找到名为“${name}”的账号。`
    })

  cmd.subcommand('.update <name>', '修改已有账号信息', { authority: 3 })
    .option('addName', '-n <name>  添加账号名', { type: 'string', fallback: '' })
    .option('removeName', '-N <name>  删除账号名', { type: 'string', fallback: '' })
    .option('bilibili', '-b <id>  设置 Bilibili 账号', { type: 'string' })
    .option('mirrativ', '-m <id>  设置 Mirrativ 账号', { type: 'string' })
    .option('twitcasting', '-t <id>  设置 TwitCasting 账号', { type: 'string' })
    .action(async ({ options }, name: string) => {
      if (!name) return '请输入账号。'
      name = String(name)
      const data = await ctx.database.findSubscribe(name, ['id', 'names', 'bilibili', 'mirrativ', 'twitcasting'])
      if (!data) return '没有找到该账号。'

      const addList = (options.addName || '').split(',')
      const usedNames = await checkNames(addList)
      if (usedNames.length) return `名称 ${usedNames.join(', ')} 已被使用。`
      const account = observe(data, diff => ctx.database.setSubscribe(data.id, diff), `subscribe ${data.id}`)

      let configUpdated = false
      for (const key of ['bilibili', 'mirrativ', 'twitcasting']) {
        const optionKey = key.toLowerCase()
        if (optionKey in options) {
          account[optionKey] = options[optionKey]
          if (key !== 'name') configUpdated = true
        }
      }

      let nameUpdated = false
      const nameSet = new Set(account.names)
      for (const name of addList) {
        if (nameSet.has(name)) continue
        nameSet.add(name)
        nameUpdated = true
      }
      const removeList = (options.removeName || '').split(',')
      for (const name of removeList) {
        if (!nameSet.has(name)) continue
        nameSet.delete(name)
        nameUpdated = true
      }
      if (nameUpdated) account.names = Array.from(nameSet)

      if (!Object.keys(account._diff).length) {
        return '没有信息被修改。'
      }

      if (configUpdated && account.id in monitors) {
        monitors[account.id].start()
      }
      await account._update()
      return '账号修改成功。'
    })

  cmd.subcommand('.check', '查看当前直播状态')
    .channelFields(['subscribe'])
    .shortcut('查看单推列表')
    .shortcut('查看直播状态', { options: { group: true } })
    .option('group', '-g  查看本群内全部直播')
    .action(async ({ session, options }) => {
      const { subscribe } = session.$channel
      const output = [options.group ? '当前群内关注的直播状态：' : '当前关注的账号列表：']
      for (const id in subscribe) {
        if (!monitors[id]) {
          logger.warn('Account Not Found:', id)
          continue
        }
        const { config, daemons } = monitors[id]
        let [message] = config.names
        if (subscribe[id].includes(session.userId)) {
          if (options.group) message += '（已关注）'
        } else if (!options.group) {
          continue
        }
        message += '：'
        if (daemons.bilibili?.isLive) {
          message += 'Bilibili 正在直播'
        } else if (daemons.mirrativ?.isLive) {
          message += 'Mirrativ 正在直播'
        } else if (daemons.twitcasting?.isLive) {
          message += 'TwitCasting 正在直播'
        } else {
          message += '未开播'
        }
        output.push(message)
      }
      if (output.length === 1) {
        return options.group ? '当前群内没有关注的直播。' : '你没有在群内关注任何主播。'
      }
      return output.join('\n')
    })

  cmd.subcommand('.subscribe <name>', '设置关注账号')
    .shortcut('单推', { prefix: true, fuzzy: true })
    .shortcut('关注', { prefix: true, fuzzy: true })
    .shortcut('取消单推', { prefix: true, fuzzy: true, options: { delete: true } })
    .shortcut('取消关注', { prefix: true, fuzzy: true, options: { delete: true } })
    .channelFields(['subscribe'])
    .option('global', '-g  设置本群默认关注', { authority: 2 })
    .option('delete', '-d  取消关注账号')
    .option('deleteAll', '-D  取消全部关注账号')
    .action(async ({ session, options }, name: string) => {
      const { subscribe } = session.$channel
      // FIXME 0
      const userId = options.global ? '0' : session.userId
      if (options.deleteAll) {
        let count = 0
        for (const id in subscribe) {
          const index = subscribe[id].indexOf(userId)
          if (index < 0) continue
          count += 1
          if (subscribe[id].length === 1) {
            delete subscribe[id]
          } else {
            subscribe[id].splice(index)
          }
        }
        if (count) {
          await session.$channel._update()
          return `已成功取消关注 ${count} 个账号。`
        } else {
          return '未在本群内关注任何账号。'
        }
      }

      if (!name) return '请输入账号。'
      name = String(name)
      const account = await ctx.database.findSubscribe(name)
      if (!account) return '没有找到该账号。'
      const { id } = account
      if (!subscribe[id]) subscribe[id] = []
      const appellation = options.global ? '本群' : '你'
      const index = subscribe[id].indexOf(userId)

      if (options.delete) {
        if (index < 0) {
          return appellation + '未关注此账号。'
        }
        if (subscribe[id].length === 1) {
          delete subscribe[id]
        } else {
          subscribe[id].splice(index)
        }
        await session.$channel._update()
        return '已成功取消关注。'
      }

      if (index >= 0) {
        return appellation + '已关注此账号。'
      }
      subscribe[id].push(userId)
      if (!monitors[id]) {
        monitors[id] = new Monitor(account, ctx.app)
        monitors[id].start()
      }
      await session.$channel._update()
      return '关注成功！'
    })
}
