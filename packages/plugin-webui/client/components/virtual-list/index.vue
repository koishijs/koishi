<template>
  <component :is="tag" @scroll="onScroll">
    <virtual-item v-if="$slots.header" @resize="onResizeSlot" uid="header">
      <slot name="header"/>
    </virtual-item>
    <div :style="wrapperStyle">
      <virtual-item v-for="(item, index) in data.slice(range.start, range.end)"
        :tag="itemTag" :class="resolveItemClass(item, index)" :uid="item[dataKey]"
        @click.stop="emit('item-click', item, $event)" @resize="onResizeItem">
        <slot v-bind="item" :index="index + range.start"/>
      </virtual-item>
    </div>
    <virtual-item v-if="$slots.footer" @resize="onResizeSlot" uid="footer">
      <slot name="footer"/>
    </virtual-item>
    <div ref="shepherd"></div>
  </component>
</template>

<script lang="ts" setup>

import { defineEmit, ref, defineProps, computed, watch, getCurrentInstance, onMounted, onActivated, onUpdated, onBeforeUnmount, defineComponent, h } from 'vue'
import Virtual from './virtual'

const emit = defineEmit(['item-click', 'resize', 'scroll', 'top', 'bottom'])

const props = defineProps({
  tag: { default: 'div' },
  dataKey: { type: String, required: true },
  data: { type: Array, required: true },
  count: { default: 50 },
  estimated: { default: 50 },
  itemTag: { default: 'div' },
  itemClass: {},
  index: { default: '' },
  topThreshold: { default: 0 },
  bottomThreshold: { default: 0 },
})

function resolveItemClass(item: any, index: number) {
  return typeof props.itemClass === 'function'
    ? props.itemClass(item, index + range.start)
    : props.itemClass
}

watch(() => props.data.length, () => {
  virtual.updateParam('uids', getUniqueIdFromDataSources())
  virtual.handleDataSourcesChange()
})

watch(() => props.count, (newValue) => {
  virtual.updateParam('keeps', newValue)
  virtual.handleSlotSizeChange()
})

watch(() => props.index, (newValue) => {
  scrollToUid(newValue)
})

const shepherd = ref<HTMLElement>()

const wrapperStyle = computed(() => {
  const { padFront, padBehind } = range
  return { padding: `${padFront}px 0px ${padBehind}px` }
})

const virtual = new Virtual({
  headerSize: 0,
  footerSize: 0,
  count: props.count,
  estimated: props.estimated,
  buffer: props.count,
  uids: getUniqueIdFromDataSources(),
})

const range = virtual.range

function getUniqueIdFromDataSources() {
  const { dataKey } = props
  return props.data.map(dataSource => dataSource[dataKey])
}

function onResizeItem(id: string, size: number) {
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
    scrollToUid(props.index)
  } else {
    scrollToBottom()
  }
})

function scrollToOffset(offset: number) {
  ctx.$el.scrollTop = offset
}

// set current scroll position to a expectant index
function scrollToUid(uid: string) {
  scrollToOffset(virtual.getUidOffset(uid))
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
  emit('scroll', ev, virtual.range)

  if (virtual.direction === 0 && !!props.data.length && (offset - props.topThreshold <= 0)) {
    emit('top')
  } else if (virtual.direction === 1 && (offset + clientLength + props.bottomThreshold >= scrollLength)) {
    emit('bottom')
  }
}

const VirtualItem = defineComponent({
  props: {
    tag: String,
    uid: String,
  },

  emits: ['resize'],

  setup(props, { slots, emit }) {
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
      emit('resize', props.uid, length)
    }

    return () => h(props.tag, slots.default())
  },
})

</script>
