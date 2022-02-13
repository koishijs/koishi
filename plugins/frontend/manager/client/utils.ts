import { useStorage } from '@vueuse/core'
import { Dict } from 'koishi'
import { reactive, watch, computed } from 'vue'
import { store } from '~/client'

export function useVersionStorage<T extends object>(key: string, version: string, fallback?: () => T) {
  const storage = useStorage('koishi.' + key, {})
  if (storage.value['version'] !== version) {
    storage.value = { version, data: fallback() }
  }
  return reactive<T>(storage.value['data'])
}

interface ManagerConfig {
  override: Dict<string>
  showInstalled: boolean
}

export const config = useVersionStorage<ManagerConfig>('managerConfig', '2.0', () => ({
  override: {},
  showInstalled: false,
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

interface ManagerState {
}

export const state = reactive<ManagerState>({})

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
