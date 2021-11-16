import type { PackageProvider } from '@koishijs/plugin-manager/src'
import type { Dict } from 'koishi'
import { store } from '~/client'
import { computed } from 'vue'

export const plugins = computed<Dict<PackageProvider.Data>>(() => {
  const result: Dict<PackageProvider.Data> = {}
  for (const name in store.packages) {
    const meta = store.packages[name]
    result[meta.shortname || ''] = meta
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a > b ? 1 : -1))
})
