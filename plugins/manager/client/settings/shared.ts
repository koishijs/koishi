import type { RegistryProvider } from '@koishijs/plugin-manager/src'
import type { Dict } from 'koishi'
import { store } from '~/client'
import { computed } from 'vue'

export interface Data extends RegistryProvider.Data {
  fullname?: string
  devDeps?: string[]
  peerDeps?: string[]
  keywords?: string[]
}

export const available = computed(() => {
  const result: Dict<Data> = {}
  for (const name in store.registry) {
    const data = store.registry[name]
    if (name && !data.id) {
      result[name] = data
    }
  }

  for (const data of store.market.filter(data => data.local && !data.local.id)) {
    result[data.shortname] = {
      name: data.shortname,
      fullname: data.name,
      config: {},
      schema: data.local.schema,
      devDeps: data.local.devDeps || [],
      peerDeps: data.local.peerDeps || [],
      keywords: data.local.keywords || [],
      ...result[data.shortname],
    }
  }

  return Object.entries(result).sort(([a], [b]) => a > b ? 1 : -1).map(([, v]) => v)
})
