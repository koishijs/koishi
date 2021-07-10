<template>
  <k-card class="k-chat-panel">
    <virtual-list
      class="k-chat-body" :item-class="resolveItemClass"
      key-name="messageId" :data="messages" :pinned="pinned"
      @click="(message) => $emit('click', message)"
      :active-key="activeKey" @update:active-key="$emit('update:activeKey', $event)">
      <template #default="props"><slot v-bind="props"/></template>
    </virtual-list>
    <div class="k-chat-footer">
      <slot name="footer"/>
      <k-input v-model="text" @enter="onEnter" @paste="onPaste"/>
    </div>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, defineProps, defineEmit } from 'vue'
import { segment } from '~/client'
import VirtualList from './list.vue'

const emit = defineEmit(['send', 'click', 'update:activeKey'])

const props = defineProps<{
  messages: any[],
  pinned?: boolean,
  itemClass?: Function,
  activeKey?: string
}>()

const text = ref('')

function resolveItemClass(item: any, index: number) {
  return 'k-chat-message ' + (props.itemClass?.(item, index) ?? '')
}

function onEnter() {
  if (!text.value) return
  emit('send', text.value)
  text.value = ''
}

async function onPaste(event: ClipboardEvent) {
  const item = event.clipboardData.items[0]
  if (item.kind === 'file') {
    event.preventDefault()
    const file = item.getAsFile()
    const reader  = new FileReader()
    reader.addEventListener('load', function () {
      emit('send', segment.image('base64://' + reader.result.slice(22)))
    }, false)
    reader.readAsDataURL(file)
  }
}

</script>

<style lang="scss">

$padding: 1.5rem;

.k-card.k-chat-panel {
  height: 100%;

  .k-card-body {
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  .k-chat-body {
    overflow-x: visible;
    overflow-y: auto;
    height: 100%;
  }

  .k-chat-footer {
    padding: 0 1rem;
  }

  .k-chat-message {
    position: relative;
    line-height: 1.5rem;
    padding: 0.25rem 1rem;

    &:hover {
      background-color: rgba(4, 4, 5, 0.2);
    }
  }

  .k-input {
    margin-top: 1rem;
    width: -webkit-fill-available;
  }
}

</style>
