import { AnalyzedPackage, Scanner } from '@koishijs/pkg-utils/src'
import { mkdirSync, writeFileSync } from 'fs-extra'
import { resolve } from 'path'
import axios from 'axios'

const BASE_URL = 'https://registry.npmjs.com'

const scanner = new Scanner(async (url) => {
  const { data } = await axios.get(BASE_URL + url)
  return data
})

const packages: AnalyzedPackage[] = []

scanner.on('item', item => packages.push(item))
scanner.on('finish', () => {
  packages.sort((a, b) => b.popularity - a.popularity)
  const folder = resolve(__dirname, '../.data')
  mkdirSync(folder, { recursive: true })
  const data = JSON.stringify({ timestamp: Date.now(), packages })
  writeFileSync(folder + '/market.json', data)
})

scanner.start()
