import { Dict } from 'koishi'
import { computed, watch } from 'vue'
import { createStorage, router, send, store } from '@koishijs/client'

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

function findPlugin(target: string, plugins: {}, prefix: string) {
  for (let key in plugins) {
    const config = plugins[key]
    if (key.startsWith('~')) key = key.slice(1)
    const request = key.split(':')[0]
    if (request === target) return prefix + key
    if (request === 'group') {
      const result = findPlugin(target, config, prefix + key + '/')
      if (result) return result
    }
  }
}

export function gotoSettings(name: string) {
  const path = findPlugin(name, store.config.plugins, '')
  if (path) {
    router.push('/plugins/' + path)
  } else {
    send('manager/unload', name, {})
    router.push('/plugins/' + name)
  }
}
