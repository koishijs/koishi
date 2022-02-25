import { store } from '@koishijs/client'
import { MarketProvider } from '@koishijs/plugin-manager'
import { getMixedMeta } from '../utils'

export function getKeywords(name: string) {
  return store.packages[name]?.keywords || store.market[name].keywords || []
}

export function validate(data: MarketProvider.Data, query: string) {
  const words = query.toLowerCase().split(/\s+/g)
  const { keywords } = getMixedMeta(data.name)
  for (const word of words) {
    if (word.startsWith('impl:')) {
      if (!keywords.includes(word)) return false
    } else if (word.startsWith('using:')) {
      const name = word.slice(6)
      if (!keywords.includes('required:' + name) && !keywords.includes('optional:' + name)) return false
    } else if (word.startsWith('author:')) {
      if (data.author?.username !== word.slice(7)) return false
    } else if (word.startsWith('is:')) {
      if (word === 'is:official') {
        if (!data.official) return false
      }
    } else {
      if (!data.shortname.toLowerCase().includes(word)) return false
    }
  }
  return true
}
