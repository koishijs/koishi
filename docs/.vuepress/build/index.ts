import scan, { AnalyzedPackage } from '@koishijs/market/src'
import { mkdirSync, writeFileSync } from 'fs-extra'
import { resolve } from 'path'
import { marked } from 'marked'
import axios from 'axios'

const BASE_URL = 'https://registry.npmjs.com'
const packages: AnalyzedPackage[] = []

scan({
  version: '4',
  async request(url) {
    const { data } = await axios.get(BASE_URL + url)
    return data
  },
  onItem(item) {
    item.description = marked
      .parseInline(item.description || '')
      .replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
    packages.push(item)
  },
}).then(() => {
  packages.sort((a, b) => b.popularity - a.popularity)
  const folder = resolve(__dirname, '../.data')
  mkdirSync(folder, { recursive: true })
  const data = JSON.stringify({ timestamp: Date.now(), packages })
  writeFileSync(folder + '/market.json', data)
})
