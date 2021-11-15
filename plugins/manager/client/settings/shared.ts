import type { PackageProvider, RegistryProvider } from '@koishijs/plugin-manager/src'
import type { Dict } from 'koishi'
import { store } from '~/client'
import { computed } from 'vue'

export interface Data extends Partial<PackageProvider.Data>, RegistryProvider.Data {
  fullname?: string
}

function safeAssign(target: any, source: any) {
  if (!target) return
  Object.assign(target, source)
}

export const plugins = computed(() => {
  const result: Dict<Data> = {}
  const temp: Dict<Data> = {}

  // packages
  for (const name in store.packages) {
    const meta = store.packages[name]
    const data = result[meta.shortname] = {
      shortname: meta.shortname,
      fullname: meta.name,
      config: {},
      schema: meta.schema,
      devDeps: meta.devDeps || [],
      peerDeps: meta.peerDeps || [],
      keywords: meta.keywords || [],
    }
    if (meta.id) temp[meta.id] = data
  }

  // registry
  for (const meta of store.registry) {
    if (meta.id) {
      // installed plugins
      safeAssign(temp[meta.id], meta)
    } else if (meta.name) {
      // disabled plugins
      safeAssign(result[meta.name], meta)
    } else {
      // app root
      result[''] = meta
    }
  }

  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a > b ? 1 : -1))
})
