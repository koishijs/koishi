import { watch } from 'vue'
import { createStorage, message, router, store } from '@koishijs/client'
import { UserAuth } from '@koishijs/plugin-auth'

interface AuthConfig extends Partial<UserAuth> {
  authType: 0 | 1
  platform?: string
  userId?: string
  showPass?: boolean
  password?: string
}

export const config = createStorage<AuthConfig>('auth', 1, () => ({
  authType: 0,
}))

watch(() => store.user, (value) => {
  if (!value) {
    return router.push('/login')
  }

  message.success(`欢迎回来，${value.name || 'Koishi 用户'}！`)
  Object.assign(config, value)
  const from = router.currentRoute.value.redirectedFrom
  if (from && !from.path.startsWith('/login')) {
    router.push(from)
  } else {
    router.push('/profile')
  }
})

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
