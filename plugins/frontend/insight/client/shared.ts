import { computed, ref } from 'vue'

export const title = ref('')

// const desc = ref('')
const active = ref(false)
const inactive = ref(true)
const left = ref(0)
const top = ref(0)

export const style = computed(() => {
  if (!left.value || !top.value) {
    return {
      display: 'none',
    }
  }
  return {
    left: left.value + 'px',
    top: top.value + 'px',
  }
})

interface MouseOrTouch {
  readonly clientX: number
  readonly clientY: number
}

function getEventPoint(event: MouseEvent | TouchEvent): MouseOrTouch {
  return event.type.startsWith('touch')
    ? [
      ...(event as TouchEvent).targetTouches,
      ...(event as TouchEvent).changedTouches,
    ][0]
    : event as MouseEvent
}

export function setTitle(text: string, event: MouseEvent | TouchEvent) {
  title.value = text
  activate(getEventPoint(event))
}

export function activate(event: MouseOrTouch) {
  active.value = true
  inactive.value = false
  left.value = event.clientX
  top.value = event.clientY
}

export function deactivate(delay = 0, clear = false) {
  inactive.value = true
  setTimeout(() => {
    if (!inactive.value) return
    active.value = false
    if (!clear) return
    left.value = null
    top.value = null
  }, delay)
}
