import { ref, watch } from 'vue'

export namespace storage {
  export function get(key: string) {
    if (typeof localStorage === 'undefined') return
    const rawData = localStorage.getItem('koishi:' + key)
    if (!rawData) return
    try {
      return JSON.parse(rawData)
    } catch {}
  }

  export function set(key: string, value: any) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem('koishi:' + key, JSON.stringify(value))
  }

  export function create<T>(key: string, fallback?: T, merge?: boolean) {
    const value = get(key)
    const wrapper = ref<T>(merge ? { ...fallback, ...value } : value || fallback)
    watch(wrapper, () => set(key, wrapper.value), {
      deep: typeof fallback === 'object',
    })
    return wrapper
  }
}
