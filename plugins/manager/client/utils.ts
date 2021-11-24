import { useStorage } from '@vueuse/core'
import { reactive } from 'vue'

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

interface ManagerState {
  downloading?: boolean
}

export const state = reactive<ManagerState>({})
