<template>
  <k-card class="k-chat-panel">
    <div class="k-chat-panel-body" ref="body">
      <template v-for="(message, index) in messages" :key="index">
        <slot v-bind="message"/>
      </template>
    </div>
    <k-input v-model="text" @enter="onEnter" @paste="onPaste"></k-input>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, watch, defineProps, onMounted, nextTick, defineEmit } from 'vue'
import { segment } from '~/client'

const emit = defineEmit(['enter'])
const props = defineProps<{ messages: any[], pinned?: boolean }>()

const text = ref('')
const body = ref<Element>(null)

onMounted(scrollToBottom)

function scrollToBottom() {
  body.value.scrollTop = body.value.scrollHeight - body.value.clientHeight
}

watch(props.messages, () => {
  const { scrollTop, clientHeight, scrollHeight } = body.value
  if (!props.pinned || Math.abs(scrollTop + clientHeight - scrollHeight) < 1) {
    nextTick(scrollToBottom)
  }
})

function onEnter() {
  if (!text.value) return
  emit('enter', text.value)
  text.value = ''
}

async function onPaste(event: ClipboardEvent) {
  const item = event.clipboardData.items[0]
  if (item.kind === 'file') {
    event.preventDefault()
    const file = item.getAsFile()
    const reader  = new FileReader()
    reader.addEventListener('load', function () {
      emit('enter', segment.image('base64://' + reader.result.slice(22)))
    }, false)
    reader.readAsDataURL(file)
  }
}

</script>

<style lang="scss">

.k-chat-panel {
  height: 100%;
  position: relative;

  .k-chat-panel-body {
    position: absolute;
    top: 2rem;
    left: 2rem;
    right: 2rem;
    bottom: 6rem;
    overflow-x: visible;
    overflow-y: auto;
  }

  .k-input {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    right: 2rem;
  }
}

</style>
