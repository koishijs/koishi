<template>
  <div class="draggable" ref="draggable">
    <div class="container" ref="target" :style="style">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { Ref, ref, reactive, computed, onMounted } from 'vue'
import { useEventListener, useResizeObserver, Position } from '@vueuse/core'

const props = defineProps<{
  width: number
  height: number
  padding: number
}>()

const scale = ref(1)
const target = ref<HTMLElement>(null)
const draggable = ref<HTMLElement>(null)
const position = reactive<Position>({ x: 0, y: 0 })

// stored positions
const pressed = ref<Position>()
const center = ref<Position>()

function restrict(val: number, min: number, max: number) {
  if (min < max) return (min + max) / 2
  if (val > min) return min
  if (val < max) return max
  return val
}

function getCenter(rect: DOMRect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

function getPressed(e: PointerEvent) {
  return {
    x: e.pageX,
    y: e.pageY,
  }
}

function move(deltaX = 0, deltaY = 0) {
  const rect = draggable.value.getBoundingClientRect()
  position.x = restrict(
    position.x + deltaX,
    rect.left + props.padding,
    rect.right - props.padding - props.width * scale.value,
  )
  position.y = restrict(
    position.y + deltaY,
    rect.top + props.padding,
    rect.bottom - props.padding - props.height * scale.value,
  )
}

function update(ref: Ref<Position>, value: Position) {
  move(value.x - ref.value.x, value.y - ref.value.y)
  ref.value = value
}

onMounted(() => {
  const rect = draggable.value.getBoundingClientRect()
  center.value = getCenter(rect)
  move(rect.left + props.padding, center.value.y - props.height / 2)
})

useResizeObserver(draggable, () => {
  update(center, getCenter(draggable.value.getBoundingClientRect()))
})

useEventListener(draggable, 'pointerdown', (e: PointerEvent) => {
  pressed.value = getPressed(e)
}, true)

useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!pressed.value) return
  update(pressed, getPressed(e))
}, true)

useEventListener(window, 'pointerup', (e: PointerEvent) => {
  pressed.value = undefined
}, true)

useEventListener(draggable, 'wheel', (e: WheelEvent) => {
  if (e.deltaX || !e.deltaY) return
  const index = Math.log2(scale.value)
  const newIndex = Math.min(1, Math.max(-1, index - e.deltaY / 100))
  const newScale = Math.pow(2, newIndex)
  const deltaX = (e.pageX - position.x) * (1 - newScale / scale.value)
  const deltaY = (e.pageY - position.y) * (1 - newScale / scale.value)
  scale.value = newScale
  move(deltaX, deltaY)
})

const style = computed(() => ({
  left: position.x + 'px',
  top: position.y + 'px',
  width: props.width + 'px',
  height: props.height + 'px',
  transform: `scale(${scale.value})`,
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
  transform-origin: top left;
}

</style>
