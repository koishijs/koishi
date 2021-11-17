import { ref, unref, reactive, computed } from 'vue-demi'
import { MaybeRef, toRefs, isClient } from '@vueuse/shared'
import { useEventListener, Position } from '@vueuse/core'

type Padding = number | [number, number?, number?, number?]

export interface UseDraggableOptions {
  container?: MaybeRef<Element>
  padding?: Padding
}

function resolvePadding(padding: Padding) {
  if (typeof padding === 'number') padding = [padding]
  padding[1] ??= padding[0]
  padding[2] ??= padding[0]
  padding[3] ??= padding[1]
  return padding
}

export function useDraggable(target: MaybeRef<Element>, options: UseDraggableOptions = {}) {
  const container = options.container
  const padding = resolvePadding(options.padding ?? 0)
  const position = reactive<Position>({ x: 0, y: 0 })
  const pressed = ref<Position>()

  function start(e: PointerEvent) {
    const rect = unref(target).getBoundingClientRect()
    pressed.value = {
      x: e.pageX - rect.left,
      y: e.pageY - rect.top,
    }
  }

  function restrict(val: number, min: number, max: number) {
    if (min < max) return Math.max(min, Math.min(max, val))
    if (val > min) return min
    if (val < max) return max
    return val
  }

  function move(e: PointerEvent) {
    if (!pressed.value) return
    const { width, height } = unref(target).getBoundingClientRect()
    const rect = unref(container).getBoundingClientRect()
    position.x = restrict(
      e.pageX - pressed.value.x,
      rect.left + padding[3],
      rect.right - padding[1] - width,
    )
    position.y = restrict(
      e.pageY - pressed.value.y,
      rect.top + padding[0],
      rect.bottom - padding[2] - height,
    )
  }

  function end(e: PointerEvent) {
    pressed.value = undefined
  }

  if (isClient) {
    useEventListener(container, 'pointerdown', start, true)
    useEventListener(window, 'pointermove', move, true)
    useEventListener(window, 'pointerup', end, true)
  }

  return {
    ...toRefs(position),
    position,
    isDragging: computed(() => !!pressed.value),
  }
}

