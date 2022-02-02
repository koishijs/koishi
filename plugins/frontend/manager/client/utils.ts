import { useStorage } from '@vueuse/core'
import { Dict } from 'koishi'
import { reactive, watch } from 'vue'
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
}

export const config = useVersionStorage<ManagerConfig>('managerConfig', '2.0', () => ({
  override: {},
}))

watch(store.packages, (value) => {
  if (!value) return
  config.override = Object.fromEntries(Object.entries(config.override).filter(([key]) => !value[key]))
})

interface ManagerState {
  downloading?: boolean
}

export const state = reactive<ManagerState>({})

export function addFavorite(name: string) {
  if (config.override[name] || store.packages[name]) return
  config.override[name] = store.market[name].version
}

export function removeFavorite(name: string) {
  delete config.override[name]
}
