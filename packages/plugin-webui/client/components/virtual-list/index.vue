<template>
  <component :is="tag" @scroll="onScroll">
    <virtual-slot v-if="$slots.header" @resize="onResizeSlot" uuid="header">
      <slot name="header"/>
    </virtual-slot>
    <div :style="wrapperStyle">
      <virtual-item v-for="(item, index) in data.slice(range.start, range.end)"
        :tag="itemTag" :class="resolveItemClass(item, index)" :uuid="item[dataKey]"
        @click.stop="emit('item-click', item, $event)" @resize="onResizeItem">
        <slot v-bind="item"/>
      </virtual-item>
    </div>
    <virtual-slot v-if="$slots.footer" @resize="onResizeSlot" uuid="footer">
      <slot name="footer"/>
    </virtual-slot>
    <div ref="shepherd"></div>
  </component>
</template>

<script lang="ts" setup>

import { defineEmit, ref, defineProps, computed, watch, getCurrentInstance, onMounted, onActivated, onUpdated, onBeforeUnmount, defineComponent, h } from 'vue'
import Virtual from './virtual'
import type { Range } from './virtual'

const emit = defineEmit(['item-click', 'resize', 'scroll', 'top', 'bottom'])

const props = defineProps({
  tag: { default: 'div' },
  dataKey: { type: String, required: true },
  data: { type: Array, required: true },
  count: { default: 50 },
  estimated: { default: 100 },
  itemTag: { default: 'div' },
  itemClass: {},
  index: { default: 0 },
  topThreshold: { default: 0 },
  bottomThreshold: { default: 0 },
})

function resolveItemClass(item: any, index: number) {
  return typeof props.itemClass === 'function'
    ? props.itemClass(item, index + range.value.start)
    : props.itemClass
}

watch(() => props.data.length, () => {
  virtual.updateParam('uniqueIds', getUniqueIdFromDataSources())
  virtual.handleDataSourcesChange()
})

watch(() => props.count, (newValue) => {
  virtual.updateParam('keeps', newValue)
  virtual.handleSlotSizeChange()
})

watch(() => props.index, (newValue) => {
  scrollToIndex(newValue)
})

let range = ref<Range>()
const shepherd = ref<HTMLElement>()

const wrapperStyle = computed(() => {
  const { padFront, padBehind } = range.value
  return { padding: `${padFront}px 0px ${padBehind}px` }
})

const virtual = new Virtual({
  slotHeaderSize: 0,
  slotFooterSize: 0,
  count: props.count,
  estimated: props.estimated,
  buffer: props.count,
  uniqueIds: getUniqueIdFromDataSources(),
}, (newRange: Range) => range.value = newRange)

range.value = virtual.getRange()

function getUniqueIdFromDataSources() {
  const { dataKey } = props
  return props.data.map(dataSource => dataSource[dataKey])
}

function onResizeItem(id, size) {
  virtual.saveSize(id, size)
  emit('resize', id, size)
}

function onResizeSlot(type, size) {
  if (type === 'header') {
    virtual.updateParam('slotHeaderSize', size)
  } else if (type === 'footer') {
    virtual.updateParam('slotFooterSize', size)
  }
}

const { ctx } = getCurrentInstance()

onActivated(() => {
  scrollToOffset(virtual.offset)
})

onMounted(() => {
  if (props.index) {
    scrollToIndex(props.index)
  } else {
    scrollToBottom()
  }
})

function scrollToOffset(offset: number) {
  ctx.$el.scrollTop = offset
}

// set current scroll position to a expectant index
function scrollToIndex(index) {
  // scroll to bottom
  if (index >= props.data.length - 1) {
    scrollToBottom()
  } else {
    const offset = virtual.getOffset(index)
    scrollToOffset(offset)
  }
}

function scrollToBottom() {
  if (shepherd.value) {
    const offset = shepherd.value.offsetTop
    scrollToOffset(offset)

    // check if it's really scrolled to the bottom
    // maybe list doesn't render and calculate to last range
    // so we need retry in next event loop until it really at bottom
    setTimeout(() => {
      const offset = Math.ceil(ctx.$el.scrollTop)
      const clientLength = Math.ceil(ctx.$el.clientHeight)
      const scrollLength = Math.ceil(ctx.$el.scrollHeight)
      if (offset + clientLength < scrollLength) {
        scrollToBottom()
      }
    }, 3)
  }
}

function onScroll(ev: MouseEvent) {
  const offset = Math.ceil(ctx.$el.scrollTop)
  const clientLength = Math.ceil(ctx.$el.clientHeight)
  const scrollLength = Math.ceil(ctx.$el.scrollHeight)

  // iOS scroll-spring-back behavior will make direction mistake
  if (offset < 0 || (offset + clientLength > scrollLength + 1) || !scrollLength) {
    return
  }

  virtual.handleScroll(offset)
  emitEvent(offset, clientLength, scrollLength, ev)
}

function emitEvent(offset: number, clientLength: number, scrollLength: number, ev: MouseEvent) {
  emit('scroll', ev, virtual.getRange())

  if (virtual.isFront() && !!props.data.length && (offset - props.topThreshold <= 0)) {
    emit('top')
  } else if (virtual.isBehind() && (offset + clientLength + props.bottomThreshold >= scrollLength)) {
    emit('bottom')
  }
}

function useWrapper(uuid: string) {
  let resizeObserver: ResizeObserver

  const { ctx } = getCurrentInstance()

  onMounted(() => {
    resizeObserver = new ResizeObserver(dispatchSizeChange)
    resizeObserver.observe(ctx.$el)
  })

  onUpdated(dispatchSizeChange)

  onBeforeUnmount(() => {
    resizeObserver.disconnect()
  })

  function dispatchSizeChange() {
    const length = ctx.$el ? ctx.$el.offsetHeight : 0
    ctx.$emit('resize', uuid, length)
  }
}

const VirtualItem = defineComponent({
  props: {
    tag: String,
    uuid: String,
  },

  emits: ['resize'],

  setup(props, { slots }) {
    useWrapper(props.uuid)
    return () => h(props.tag, slots.default())
  },
})

const VirtualSlot = defineComponent({
  props: {
    tag: String,
    uuid: String,
  },

  emits: ['resize'],

  setup(props, { slots }) {
    useWrapper(props.uuid)
    return () => h(props.tag, slots.default())
  },
})

</script>
