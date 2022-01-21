import { promises as fsp } from 'fs'

export { resolve as resolveLocation } from 'path'

export async function getStats(location: string) {
  const { size } = await fsp.stat(location)
  return { size }
}
