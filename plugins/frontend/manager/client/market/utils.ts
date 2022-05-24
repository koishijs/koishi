import { store } from '@koishijs/client'
import { MarketProvider } from '@koishijs/plugin-manager'
import { getMixedMeta } from '../utils'

export function getKeywords(name: string) {
  return store.packages[name]?.keywords || store.market[name].keywords || []
}

export function validate(data: MarketProvider.Data, word: string) {
  const { locales, service } = getMixedMeta(data.name).manifest
  if (word.startsWith('impl:')) {
    return service.implements.includes(word.slice(5))
  } else if (word.startsWith('locale:')) {
    return locales.includes(word.slice(7))
  } else if (word.startsWith('using:')) {
    const name = word.slice(6)
    return service.required.includes(name) || service.optional.includes(name)
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
