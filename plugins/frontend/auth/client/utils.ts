import { useStorage } from '@vueuse/core'
import { reactive, ref } from 'vue'

export function useVersionStorage<T extends object>(key: string, version: string, fallback?: () => T) {
  const storage = useStorage('koishi.' + key, {})
  if (storage.value['version'] !== version) {
    storage.value = { version, data: fallback() }
  }
  return reactive<T>(storage.value['data'])
}

export const user = ref()

interface AuthConfig {
  authType: 0 | 1
  username?: string
  password?: string
  platform?: string
  userId?: string
  showPass?: boolean
}

export const config = useVersionStorage<AuthConfig>('managerConfig', '2.0', () => ({
  authType: 0,
}))

export async function sha256(password: string) {
  const data = new TextEncoder().encode(password)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const view = new DataView(buffer)
  let output = ''
  for (let i = 0; i < view.byteLength; i += 4) {
    output += ('00000000' + view.getUint32(i).toString(16)).slice(-8)
  }
  return output
}
