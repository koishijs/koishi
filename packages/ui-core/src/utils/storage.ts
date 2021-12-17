import { useEventListener } from '@vueuse/core'
import { ref, watch } from 'vue'

export function useStorage<T extends {}>(key: string, defaultValue: T) {
  const data = ref<T>(defaultValue)
  if (typeof localStorage === 'undefined') return data

  function read(source: string) {
    try {
      if (source == null) {
        write(data.value = defaultValue)
      } else {
        data.value = {
          ...defaultValue,
          ...JSON.parse(source),
        }
      }
    } catch (e) {
      console.warn(e)
    }
  }

  function write(value: T) {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  read(localStorage.getItem(key))

  useEventListener(window, 'storage', ev => read(ev.newValue))

  watch(data, write, { deep: true })

  return data
}
