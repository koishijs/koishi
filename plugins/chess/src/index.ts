import { Context, Tables, isInteger, segment, Dict, Schema } from 'koishi'
import { State, MoveResult, StateData } from './state'
import {} from '@koishijs/plugin-puppeteer'
import * as go from './go'
import * as gomoku from './gomoku'
import * as othello from './othello'

Tables.extend('channel', {
  // do not use shorthand because the initial value is `null`
  chess: { type: 'json' },
})

interface Rule {
  placement?: 'grid' | 'cross'
  create?: (this: State) => string | void
  update?: (this: State, x: number, y: number, value: -1 | 1) => MoveResult | string
}

const rules: Dict<Rule> = {
  go,
  gomoku,
  othello,
}

declare module 'koishi' {
  interface Channel {
    chess: StateData
  }

  interface Modules {
    chess: typeof import('.')
  }
}

const states: Dict<State> = {}

export * from './state'

export interface Config {}

export const name = 'chess'

export const schema: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx = ctx.guild()

  State.imageMode = !!ctx.puppeteer
  ctx.on('service/puppeteer', () => State.imageMode = true)

  ctx.on('connect', async () => {
    if (!ctx.database) return
    const channels = await ctx.database.getAssignedChannels(['id', 'chess'])
    for (const { id, chess } of channels) {
      if (chess) {
        states[id] = State.from(chess)
        states[id].update = rules[chess.rule].update
      }
    }
  })

  ctx.command('chess [position]', '棋类游戏')
    .userFields(['name'])
    .channelFields(['chess'])
    .shortcut('落子', { fuzzy: true })
    .shortcut('悔棋', { options: { repent: true } })
    .shortcut('围棋', { options: { size: 19, rule: 'go' }, fuzzy: true })
    .shortcut('五子棋', { options: { size: 15, rule: 'gomoku' }, fuzzy: true })
    .shortcut('奥赛罗', { options: { size: 8, rule: 'othello' }, fuzzy: true })
    .shortcut('黑白棋', { options: { size: 8, rule: 'othello' }, fuzzy: true })
    .shortcut('停止下棋', { options: { stop: true } })
    .shortcut('跳过回合', { options: { skip: true } })
    .shortcut('查看棋盘', { options: { show: true } })
    .option('rule', '<rule>  设置规则，支持的规则有 go, gomoku, othello')
    .option('size', '<size>  设置大小')
    .option('skip', '跳过回合')
    .option('repent', '悔棋')
    .option('show', '-v, --show, --view  显示棋盘')
    .option('stop', '-e, --stop, --end  停止游戏')
    .usage([
      '输入“五子棋”“黑白棋”“围棋”开始对应的一局游戏。',
      '再输入“落子 A1”将棋子落于 A1 点上。',
      '目前默认使用图片模式。文本模式速度更快，但是在部分机型上可能无法正常显示，同时无法适应过大的棋盘。',
    ].join('\n'))
    .action(async ({ session, options }, position) => {
      const { cid, userId, channel = { chess: null } } = session

      if (!states[cid]) {
        if (position || options.stop || options.repent || options.skip) {
          return '没有正在进行的游戏。输入“下棋”开始一轮游戏。'
        }

        if (!isInteger(options.size) || options.size < 2 || options.size > 20) {
          return '棋盘大小应该为不小于 2，不大于 20 的整数。'
        }

        const rule = rules[options.rule]
        if (!rule) return '没有找到对应的规则。'

        const state = new State(options.rule, options.size, rule.placement || 'cross')
        state.p1 = userId

        if (rule.create) {
          const result = rule.create.call(state)
          if (result) return result
        }
        state.update = rule.update
        states[cid] = state
        state.save()

        return state.draw(session, `${session.username} 发起了游戏！`)
      }

      if (options.stop) {
        delete states[cid]
        channel.chess = null
        return '游戏已停止。'
      }

      const state = states[cid]

      if (options.show) return state.draw(session)

      if (state.p2 && state.p1 !== userId && state.p2 !== userId) {
        return '游戏已经开始，无法加入。'
      }

      if (options.skip) {
        if (!state.next) return '对局尚未开始。'
        if (state.next !== userId) return '当前不是你的回合。'
        state.next = state.p1 === userId ? state.p2 : state.p1
        channel.chess = state.serial()
        return `${session.username} 选择跳过其回合，下一手轮到 ${segment.at(state.next)}。`
      }

      if (options.repent) {
        if (!state.next) return '对局尚未开始。'
        const last = state.p1 === state.next ? state.p2 : state.p1
        if (last !== userId) return '上一手棋不是你所下。'
        state.history.pop()
        state.refresh()
        state.next = last
        channel.chess = state.serial()
        return state.draw(session, `${session.username} 进行了悔棋。`)
      }

      if (!position) return '请输入坐标。'

      let isLetterFirst = false
      if (typeof position !== 'string' || !(isLetterFirst = /^[a-z]\d+$/i.test(position)) && !/^\d+[a-z]$/i.test(position)) {
        return '请输入由字母+数字构成的坐标。'
      }

      if (state.p2 && userId !== state.next) return '当前不是你的回合。'

      const [x, y] = isLetterFirst ? [
        position.charCodeAt(0) % 32 - 1,
        parseInt(position.slice(1)) - 1,
      ] : [
        position.slice(-1).charCodeAt(0) % 32 - 1,
        parseInt(position.slice(0, -1)) - 1,
      ]

      if (x >= state.size || y >= state.size || y < 0) {
        return '落子超出边界。'
      }

      if (state.get(x, y)) return '此处已有落子。'

      let message = ''
      if (state.next || userId === state.p1) {
        message = `${session.username} 落子于 ${position.toUpperCase()}，`
      } else {
        if (state.history.length === 1) {
          state.p2 = state.p1
          state.p1 = userId
        } else {
          state.p2 = userId
        }
        message = `${session.username} 加入了游戏并落子于 ${position.toUpperCase()}，`
      }

      const value = userId === state.p1 ? 1 : -1
      const result = state.update(x, y, value)

      switch (result) {
        case MoveResult.illegal:
          state.next = userId
          return '非法落子。'
        case MoveResult.skip:
          message += `下一手依然轮到 ${segment.at(userId)}。`
          break
        case MoveResult.p1Win:
          delete states[cid]
          channel.chess = null
          return message + `恭喜 ${segment.at(state.p1)} 获胜！`
        case MoveResult.p2Win:
          delete states[cid]
          channel.chess = null
          return message + `恭喜 ${segment.at(state.p2)} 获胜！`
        case MoveResult.draw:
          delete states[cid]
          channel.chess = null
          return message + '本局游戏平局。'
        case undefined:
          // eslint-disable-next-line no-cond-assign
          if (state.next = userId === state.p1 ? state.p2 : state.p1) {
            message += `下一手轮到 ${segment.at(state.next)}。`
          } else {
            message = message.slice(0, -1) + '。'
          }
          break
        default:
          state.next = userId
          return `非法落子（${result}）。`
      }

      state.save()
      channel.chess = state.serial()
      return state.draw(session, message, x, y)
    })

  ctx.with(['puppeteer'], (ctx) => {
    ctx.command('chess', { patch: true })
      .option('imageMode', '-i  使用图片模式')
      .option('textMode', '-t  使用文本模式')
      .action(({ session, options }) => {
        const state = states[session.cid]
        if (!state) return
        if (options.textMode) {
          state.imageMode = false
          return state.draw(session, '已切换到文本模式。')
        } else if (options.imageMode) {
          state.imageMode = true
          return state.draw(session, '已切换到图片模式。')
        }
      })
  })
}
