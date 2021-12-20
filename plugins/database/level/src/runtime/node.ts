import { stat } from 'fs/promises'

export { resolve as resolveLocation } from 'path'

export async function getStats(location: string) {
  const { size } = await stat(location)
  return { size }
}
