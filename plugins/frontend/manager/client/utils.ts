import { Dict } from 'koishi'
import { computed, watch } from 'vue'
import { createStorage, store } from '@koishijs/client'

interface ManagerConfig {
  override: Dict<string>
  showInstalled?: boolean
  hideWorkspace?: boolean
}

export const config = createStorage<ManagerConfig>('manager', 2, () => ({
  override: {},
  showInstalled: false,
  hideWorkspace: true,
}))

export const overrideCount = computed(() => {
  return Object.values(config.override).filter(value => value !== undefined).length
})

watch(() => store.dependencies, (value) => {
  if (!value) return
  for (const key in config.override) {
    if (!config.override[key]) {
      if (!value[key]) delete config.override[key]
    } else if (value[key]?.request === config.override[key]) {
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
  peerDependencies: {},
  ...store.market[name],
  ...store.packages[name],
})
