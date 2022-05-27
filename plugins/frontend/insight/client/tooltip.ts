import { computed, reactive, ref, StyleValue } from 'vue'
import { useEventListener } from '@vueuse/core'

export interface Pointer {
  readonly clientX: number
  readonly clientY: number
}

export function getEventPoint(event: MouseEvent | TouchEvent): Pointer {
  return event.type.startsWith('touch')
    ? [
      ...(event as TouchEvent).targetTouches,
      ...(event as TouchEvent).changedTouches,
    ][0]
    : event as MouseEvent
}

export function useTooltip() {
  const content = ref('')

  const active = ref(false)
  const inactive = ref(true)
  const left = ref(0)
  const top = ref(0)

  const style = computed<StyleValue>(() => {
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

  function activate(text: string, event: MouseEvent | TouchEvent) {
    content.value = text
    active.value = true
    inactive.value = false
    const pointer = getEventPoint(event)
    left.value = pointer.clientX
    top.value = pointer.clientY
  }

  function deactivate(delay = 0, clear = false) {
    inactive.value = true
    setTimeout(() => {
      if (!inactive.value) return
      active.value = false
      if (!clear) return
      left.value = null
      top.value = null
    }, delay)
  }

  useEventListener('mousemove', onPointerMove)
  useEventListener('touchmove', onPointerMove)

  function onPointerMove(event: MouseEvent | TouchEvent) {
    if (inactive.value) return
    const pointer = getEventPoint(event)
    top.value = pointer.clientY
    left.value = pointer.clientX
  }

  return reactive({
    style,
    content,
    active,
    inactive,
    activate,
    deactivate,
  })
}
