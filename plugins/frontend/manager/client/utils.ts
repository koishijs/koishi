import { Dict } from 'koishi'
import { watch, computed } from 'vue'
import { store, createStorage } from '~/client'

interface ManagerConfig {
  override: Dict<string>
  showInstalled?: boolean
  showDepsOnly?: boolean
}

export const config = createStorage<ManagerConfig>('manager', '2.0', () => ({
  override: {},
  showInstalled: false,
  showDepsOnly: false,
}))

export const overrideCount = computed(() => {
  return Object.values(config.override).filter(value => value !== undefined).length
})

watch(store.packages, (value) => {
  if (!value) return
  for (const key in config.override) {
    if (!config.override[key]) {
      if (!value[key]) delete config.override[key]
    } else if (value[key]?.version === config.override[key]) {
      delete config.override[key]
    }
  }
}, { immediate: true })

export function addFavorite(name: string) {
  if (config.override[name] || store.packages[name]) return
  config.override[name] = store.market[name].version
}

export function removeFavorite(name: string) {
  delete config.override[name]
}

export const getMixedMeta = (name: string) => ({
  keywords: [],
  devDeps: [],
  peerDeps: [],
  ...store.market[name],
  ...store.packages[name],
})
