<template>
  <div class="draggable" ref="draggable">
    <div class="container" ref="target" :style="style">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { ref, unref, reactive, computed } from 'vue'
import { useEventListener, Position } from '@vueuse/core'

const props = defineProps<{
  width: string
  height: string
  padding: number
}>()

const target = ref<HTMLElement>(null)
const draggable = ref<HTMLElement>(null)
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
  const rect = unref(draggable).getBoundingClientRect()
  position.x = restrict(
    e.pageX - pressed.value.x,
    rect.left + props.padding,
    rect.right - props.padding - width,
  )
  position.y = restrict(
    e.pageY - pressed.value.y,
    rect.top + props.padding,
    rect.bottom - props.padding - height,
  )
}

function end(e: PointerEvent) {
  pressed.value = undefined
}

useEventListener(draggable, 'pointerdown', start, true)
useEventListener(window, 'pointermove', move, true)
useEventListener(window, 'pointerup', end, true)

const style = computed(() => ({
  left: position.x + 'px',
  top: position.y + 'px',
  width: props.width,
  height: props.height,
}))

</script>

<style lang="scss" scoped>

.draggable {
  position: fixed;
  left: var(--aside-width);
  right: 0;
  top: 0;
  bottom: 0;
}

.container {
  position: fixed;
  user-select: none;
  overflow: hidden;
}

</style>
