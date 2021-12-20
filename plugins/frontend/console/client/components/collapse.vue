<template>
  <div class="k-collapse" :class="{ header: $slots.header, closed: isClosed }">
    <div class="slot-header" tabindex="0" @click.stop="onClickHeader" v-if="$slots.header">
      <slot name="header"/>
    </div>
    <collapse-transition
      @before-enter="beforeEnter" @after-enter="afterEnter"
      @before-leave="beforeLeave" @after-leave="afterLeave">
      <div class="content" v-show="isOpen">
        <slot/>
      </div>
    </collapse-transition>
  </div>
</template>

<script lang="ts" setup>

import { ref, watch } from 'vue'
import CollapseTransition from './transitions/collapse.vue'

function isBoolean(value) {
  return value === true || value === false
}

const isOpen = ref(true)
const isClosed = ref(true)

const props = defineProps<{
  modelValue?: boolean
  initial?: 'open' | 'closed'
}>()

const emit = defineEmits(['update:modelValue', 'before-update', 'after-update'])

if (props.initial) {
  isOpen.value = props.initial === 'open'
} else {
  isOpen.value = props.modelValue
  watch(() => props.modelValue, (value) => {
    if (isBoolean(value) && value !== isOpen.value) isOpen.value = value
  })
}

function onClickHeader(event: MouseEvent) {
  if (props.initial) {
    isOpen.value = !isOpen.value
  } else {
    emit('update:modelValue', !props.modelValue)
  }
}

isClosed.value = !isOpen.value

function beforeEnter() {
  emit('before-update')
  isClosed.value = false
}

function afterEnter() {
  emit('after-update')
}

function beforeLeave() {
  emit('before-update')
}

function afterLeave() {
  isClosed.value = true
  emit('after-update')
}

</script>

<style lang="scss" scoped>

.k-collapse {
  position: relative;
  background-color: transparent;
  width: -webkit-fill-available;
  transition: background-color 0.3s ease;
  border-bottom: 1px solid #ebeef5;

  > .slot-header {
    color: #303133;
    padding: 8px 16px;
    font-size: 20px;
    line-height: 1.5em;
    font-weight: bold;
    border: none;
    outline: none;
    cursor: pointer;
    position: relative;
    transition: 0.3s ease;
  }

  > .content {
    position: relative;
    transition: 0.3s ease;
  }

  &.header:hover { background-color: #f5f7fa }
  &.closed:not(.header) { border-bottom: none }
}

</style>
