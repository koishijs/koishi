import { State } from './state'

const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const

function findEaten(state: State, x: number, y: number) {
  const value = state.get(x, y)
  if (!value) return 0n
  let found = 0n
  function findLife(x: number, y: number) {
    found |= state.bit(x, y)
    const points: [number, number][] = []
    for (const [dx, dy] of directions) {
      const i = x + dx, j = y + dy
      if (!state.inRange(i, j) || found & state.bit(i, j)) continue
      const next = state.get(i, j)
      if (!next) return true
      if (next === -value) continue
      if (next === value) points.push([i, j])
    }
    for (const [i, j] of points) {
      const result = findLife(i, j)
      if (result) return true
    }
  }
  return findLife(x, y) ? 0n : found
}

export function update(this: State, x: number, y: number, value: -1 | 1) {
  const { bBoard, wBoard } = this
  if (value === 1) {
    this.bBoard |= this.bit(x, y)
  } else {
    this.wBoard |= this.bit(x, y)
  }
  let diff = 0n
  for (const [dx, dy] of directions) {
    const i = x + dx, j = y + dy
    if (!this.inRange(i, j)) continue
    if (this.get(i, j) === -value) {
      diff |= findEaten(this, i, j)
    }
  }

  if (diff) {
    if (value === 1) {
      this.wBoard ^= diff
    } else {
      this.bBoard ^= diff
    }
  } else if (findEaten(this, x, y)) {
    this.bBoard = bBoard
    this.wBoard = wBoard
    return '不入子'
  }

  if (this.history.includes((this.wBoard << this.area) + this.bBoard)) {
    this.bBoard = bBoard
    this.wBoard = wBoard
    return '全局同形'
  }
}
