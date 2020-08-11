import { State, MoveResult } from './state'

export const placement = 'grid'

export function create(this: State) {
  const { size } = this
  if (size % 2 !== 0 || size === 2) return '棋盘大小应为不小于 4 的 2 的倍数。'
  const mid = size / 2
  this.set(mid - 1, mid - 1, -1)
  this.set(mid - 1, mid, 1)
  this.set(mid, mid - 1, 1)
  this.set(mid, mid, -1)
}

const delta = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const

function legal(state: State, x: number, y: number, value: -1 | 1) {
  let diff = 0n
  for (const [dx, dy] of delta) {
    let i = x + dx, j = y + dy
    if (!state.inRange(i, j) || state.get(i, j) !== -value) continue
    let temp = 0n
    do {
      temp |= state.bit(i, j)
      i += dx
      j += dy
    } while (state.inRange(i, j) && state.get(i, j) === -value)
    if (state.inRange(i, j) && state.get(i, j) === value) diff |= temp
  }
  return diff
}

function hasLegalMove(state: State, value: -1 | 1) {
  for (let i = 0; i < state.size; i++) {
    for (let j = 0; j < state.size; j++) {
      if (!state.get(i, j) && legal(state, i, j, value)) return true
    }
  }
}

function total(length: number, board: bigint) {
  let count = 0
  for (let i = 0n; i < length; i++) {
    count += board & 1n << i ? 1 : 0
  }
  return count
}

function check(state: State): MoveResult {
  const length = state.size * state.size
  const bCount = total(length, state.bBoard)
  const wCount = total(length, state.wBoard)
  return Math.sign(bCount - wCount) || MoveResult.draw as any
}

export function update(this: State, x: number, y: number, value: -1 | 1): MoveResult {
  const diff = legal(this, x, y, value)
  if (!diff) return MoveResult.illegal
  this.wBoard ^= diff
  this.bBoard ^= diff
  this.set(x, y, value)
  if (this.isFull) return check(this)
  if (!hasLegalMove(this, -value as -1 | 1)) {
    if (!hasLegalMove(this, value)) return check(this)
    return MoveResult.skip
  }
}
