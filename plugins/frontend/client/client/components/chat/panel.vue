<template>
  <component :is="tag || 'div'" class="k-chat-panel">
    <virtual-list
      class="k-chat-body" :item-class="resolveItemClass"
      key-name="messageId" :data="messages" :pinned="pinned"
      @click="(message) => $emit('click', message)"
      :active-key="activeKey" @update:active-key="$emit('update:activeKey', $event)">
      <template #default="props"><slot v-bind="props"/></template>
    </virtual-list>
    <div class="k-chat-footer">
      <input
        autocomplete="off"
        step="any"
        :value="text"
        @input="text = $event.target['value']"
        @paste="onPaste"
        @keydown.enter.stop="onEnter"
      />
    </div>
  </component>
</template>

<script lang="ts" setup>

import { ref } from 'vue'
import segment from '@koishijs/segment'
import VirtualList from './list.vue'

const emit = defineEmits(['send', 'click', 'paste', 'update:activeKey'])

const props = defineProps<{
  tag?: string
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

.k-chat-panel {
  display: flex;
  flex-direction: column;

  .k-chat-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);

    input {
      padding: 0;
      width: 100%;
      border: none;
      outline: none;
      font-size: 1em;
      height: inherit;
      color: inherit;
      display: inline-block;
      border-radius: 0.3em;
      transition: 0.3s ease;
      box-sizing: border-box;
      background-color: transparent;
    }
  }

  .k-chat-message {
    position: relative;
  }
}

</style>
