import { store } from '@koishijs/client'
import { MarketProvider } from '@koishijs/plugin-manager'
import { getMixedMeta } from '../utils'

export function getKeywords(name: string) {
  return store.packages[name]?.keywords || store.market[name].keywords || []
}

export function validate(data: MarketProvider.Data, word: string) {
  const { keywords } = getMixedMeta(data.name)
  if (word.startsWith('impl:')) {
    return keywords.includes(word)
  } else if (word.startsWith('locale:')) {
    return keywords.includes(word)
  } else if (word.startsWith('using:')) {
    const name = word.slice(6)
    return keywords.includes('required:' + name) || keywords.includes('optional:' + name)
  } else if (word.startsWith('email:')) {
    return data.author?.email === word.slice(6)
  } else if (word.startsWith('is:')) {
    if (word === 'is:official') {
      return data.official
    } else {
      return true
    }
  }

  if (data.shortname.includes(word)) return true
  return data.keywords.some((keyword) => {
    return !keyword.includes(':') && keyword.includes(word)
  })
}
