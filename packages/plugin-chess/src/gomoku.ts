import { State, MoveResult } from './state'

export function update(this: State, x: number, y: number, value: -1 | 1): MoveResult {
  const { size } = this
  const board = this.set(x, y, value)
  let vCount = 0, hCount = 0, mCount = 0, pCount = 0
  for (let i = x - 1; i >= 0 && board & this.bit(i, y); i--) vCount++
  for (let i = x + 1; i < size && board & this.bit(i, y); i++) vCount++
  if (vCount >= 4) return value
  for (let j = y - 1; j >= 0 && board & this.bit(x, j); j--) hCount++
  for (let j = y + 1; j < size && board & this.bit(x, j); j++) hCount++
  if (hCount >= 4) return value
  for (let i = x - 1, j = y - 1; i >= 0 && j >= 0 && board & this.bit(i, j); i--, j--) mCount++
  for (let i = x + 1, j = y + 1; i < size && j < size && board & this.bit(i, j); i++, j++) mCount++
  if (mCount >= 4) return value
  for (let i = x - 1, j = y + 1; i >= 0 && j < size && board & this.bit(i, j); i--, j++) pCount++
  for (let i = x + 1, j = y - 1; i < size && j >= 0 && board & this.bit(i, j); i++, j--) pCount++
  if (pCount >= 4) return value
  if (this.isFull) return MoveResult.draw
}
