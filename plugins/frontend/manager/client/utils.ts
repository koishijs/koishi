import { useStorage } from '@vueuse/core'
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
  favorites: string[]
}

export const config = useVersionStorage<ManagerConfig>('managerConfig', '1.0', () => ({
  favorites: [],
}))

watch(store.packages, (value) => {
  if (!value) return
  config.favorites = config.favorites.filter(name => !value[name])
})

interface ManagerState {
  downloading?: boolean
}

export const state = reactive<ManagerState>({})

export function addFavorite(name: string) {
  if (config.favorites.includes(name) || store.packages[name]) return
  config.favorites.push(name)
}
