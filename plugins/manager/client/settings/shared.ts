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

function safeAssign(target: any, source: any) {
  if (!target) return
  Object.assign(target, source)
}

export const plugins = computed(() => {
  const result: Dict<Data> = {}
  const temp: Dict<Data> = {}

  // market
  for (const meta of store.market) {
    if (!meta.local) continue
    const data = result[meta.shortname] = {
      name: meta.shortname,
      fullname: meta.name,
      config: {},
      schema: meta.local.schema,
      devDeps: meta.local.devDeps || [],
      peerDeps: meta.local.peerDeps || [],
      keywords: meta.local.keywords || [],
    }
    if (meta.local.id) temp[meta.local.id] = data
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
