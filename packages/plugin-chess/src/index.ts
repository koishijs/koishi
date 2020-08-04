import { Context, Group } from 'koishi-core'
import { isInteger } from 'koishi-utils'
import { State, MoveResult, StateData } from './state'
import * as go from './go'
import * as gomoku from './gomoku'
import * as othello from './othello'

interface Rule {
  placement?: 'grid' | 'cross'
  create?: (this: State) => string | void
  update?: (this: State, x: number, y: number, value: -1 | 1) => MoveResult
}

const rules: Record<string, Rule> = {
  go,
  gomoku,
  othello,
}

declare module 'koishi-core/dist/database' {
  interface Group {
    chess: StateData
  }
}

Group.extend(() => ({
  chess: null,
}))

const states: Record<number, State> = {}

export * from './state'

export const name = 'chess'

export function apply (ctx: Context) {
  ctx = ctx.group()

  ctx.on('connect', async () => {
    const groups = await ctx.database.getAllGroups(['id', 'chess'])
    for (const { id, chess } of groups) {
      if (chess) {
        states[id] = State.from(ctx.app, chess)
        states[id].update = rules[chess.rule].update
      }
    }
  })

  ctx.command('chess [position]', '棋类游戏')
    .userFields(['name'])
    .groupFields(['chess'])
    .shortcut('落子', { fuzzy: true })
    .shortcut('悔棋', { options: { repent: true } })
    .shortcut('围棋', { options: { size: 19, rule: 'go' }, fuzzy: true })
    .shortcut('五子棋', { options: { size: 15, rule: 'gomoku' }, fuzzy: true })
    .shortcut('奥赛罗', { options: { size: 8, rule: 'othello' }, fuzzy: true })
    .shortcut('黑白棋', { options: { size: 8, rule: 'othello' }, fuzzy: true })
    .shortcut('停止下棋', { options: { stop: true }})
    .shortcut('跳过回合', { options: { skip: true }})
    .shortcut('使用图片模式', { options: { imageMode: true } })
    .shortcut('使用文本模式', { options: { textMode: true } })
    .option('-i, --image-mode', '使用图片模式')
    .option('-t, --text-mode', '使用文本模式')
    .option('--rule <rule>', '设置规则，支持的规则有 go, gomoku, othello')
    .option('--size <size>', '设置大小')
    .option('--skip', '跳过回合')
    .option('--repent', '悔棋')
    .option('-v, --show, --draw, --view', '显示棋盘')
    .option('-e, --stop, --end', '停止游戏')
    .usage([
      '输入“五子棋”“黑白棋”“围棋”开始对应的一局游戏。',
      '再输入“落子 A1”将棋子落于 A1 点上。',
      '目前默认使用图片模式。文本模式速度更快，但是在部分机型上可能无法正常显示，同时无法适应过大的棋盘。'
    ].join('\n'))
    .action(async ({ session, options }, position) => {
      if (!states[session.groupId]) {
        if (position || options.stop || options.repent || options.skip) {
          return session.$send('没有正在进行的游戏。输入“下棋”开始一轮游戏。')
        }

        if (!isInteger(options.size) || options.size < 2 || options.size > 20) {
          return session.$send('棋盘大小应该为不小于 2，不大于 20 的整数。')
        }

        const rule = rules[options.rule]
        if (!rule) return session.$send('没有找到对应的规则。')

        const state = new State(ctx.app, options.rule, options.size, rule.placement || 'cross')
        state.p1 = session.userId

        if (options.textMode) state.imageMode = false

        if (rule.create) {
          const result = rule.create.call(state)
          if (result) return session.$send(result)
        }
        state.update = rule.update
        states[session.groupId] = state

        return state.draw(session, `${session.$username} 发起了游戏！`)
      }

      if (options.stop) {
        delete states[session.groupId]
        session.$group.chess = null
        return session.$send('游戏已停止。')
      }

      const state = states[session.groupId]

      if (options.textMode) {
        state.imageMode = false
        return state.draw(session, '已切换到文本模式。')
      } else if (options.imageMode) {
        state.imageMode = true
        return state.draw(session, '已切换到图片模式。')
      }

      if (options.show) return state.draw(session)

      if (state.p2 && state.p1 !== session.userId && state.p2 !== session.userId) {
        return session.$send('游戏已经开始，无法加入。')
      }

      if (options.skip) {
        if (state.next !== session.userId) return session.$send('当前不是你的回合。')
        state.next = state.p1 === session.userId ? state.p2 : state.p1
        session.$group.chess = state.serial()
        return session.$send(`${session.$username} 选择跳过其回合，下一手轮到 [CQ:at,qq=${state.next}]。`)
      }

      if (options.repent) {
        if (!state.p2) return session.$send('尚未有人行棋。')
        const last = state.p1 === state.next ? state.p2 : state.p1
        if (last !== session.userId) return session.$send('上一手棋不是你所下。')
        state.history.pop()
        state.refresh()
        state.next = last
        session.$group.chess = state.serial()
        return state.draw(session, `${session.$username} 进行了悔棋。`)
      }

      if (!position) return session.$send('请输入坐标。')

      if (typeof position !== 'string' || !/^[a-z]\d+$/i.test(position)) {
        return session.$send('请输入由字母+数字构成的坐标。')
      }

      if (!state.p2) {
        if (session.userId === state.p1) return session.$send('当前不是你的回合。')
      } else {
        if (session.userId !== state.next) return session.$send('当前不是你的回合。')
      }

      const x = position.charCodeAt(0) % 32 - 1
      const y = parseInt(position.slice(1)) - 1
      if (x >= state.size || y >= state.size || y < 0) {
        return session.$send('落子超出边界。')
      }

      if (state.get(x, y)) return session.$send('此处已有落子。')

      let message = ''
      if (!state.p2) {
        state.p2 = session.userId
        message = `${session.$username} 加入了游戏并落子于 ${position.toUpperCase()}，`
      } else {
        message = `${session.$username} 落子于 ${position.toUpperCase()}，`
      }

      const value = session.userId === state.p1 ? -1 : 1
      const result = state.update.call(state, x, y, value) as MoveResult

      switch (result) {
        case MoveResult.illegal:
          state.next = session.userId
          return session.$send('非法落子。')
        case MoveResult.skip:
          message += `下一手依然轮到 [CQ:at,qq=${session.userId}]。`
          break
        case MoveResult.p1Win:
          message += `恭喜 [CQ:at,qq=${state.p1}] 获胜！`
          delete states[session.groupId]
          session.$group.chess = null
          break
        case MoveResult.p2Win:
          message += `恭喜 [CQ:at,qq=${state.p2}] 获胜！`
          delete states[session.groupId]
          session.$group.chess = null
          break
        case MoveResult.draw:
          message += `本局游戏平局。`
          delete states[session.groupId]
          session.$group.chess = null
          break
        default:
          state.next = session.userId === state.p1 ? state.p2 : state.p1
          message += `下一手轮到 [CQ:at,qq=${state.next}]。`
      }

      session.$group.chess = state.serial()
      return state.draw(session, message, x, y)
    })
}
