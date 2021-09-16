import type { Dict, Registry } from '~/server'
import { registry, market } from '~/client'
import { computed } from 'vue'

export interface Data extends Registry.Data {
  fullname?: string
  devDeps?: string[]
  peerDeps?: string[]
}

export const available = computed(() => {
  const result: Dict<Data> = {}
  for (const data of registry.value.filter(data => data.name && !data.id)) {
    result[data.name] = data
  }

  for (const data of market.value.filter(data => data.local && !data.local.id)) {
    result[data.shortname] = {
      name: data.shortname,
      fullname: data.name,
      schema: data.local.schema,
      delegates: data.local.delegates,
      devDeps: data.local.devDeps,
      peerDeps: data.local.peerDeps,
      config: {},
      ...result[data.shortname],
    }
  }

  return Object.entries(result).sort(([a], [b]) => a > b ? 1 : -1).map(([, v]) => v)
})
