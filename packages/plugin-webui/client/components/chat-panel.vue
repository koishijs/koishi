<template>
  <k-card class="k-chat-panel">
    <div class="k-chat-body" ref="body">
      <div class="k-chat-message" v-for="(message, index) in messages" :key="index" @click="$emit('click', message)">
        <slot v-bind="message"/>
      </div>
    </div>
    <div class="k-chat-footer">
      <slot name="footer"/>
      <k-input v-model="text" @enter="onEnter" @paste="onPaste"/>
    </div>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, watch, defineProps, onMounted, nextTick, defineEmit } from 'vue'
import { segment } from '~/client'

const emit = defineEmit(['send', 'click'])
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
    padding: 1rem 0.5rem;
    display: flex;
    flex-direction: column;
    height: -webkit-fill-available;
  }

  .k-chat-body {
    overflow-x: visible;
    overflow-y: auto;
  }

  .k-chat-footer {
    padding: 0 0.5rem;
  }

  .k-chat-message {
    position: relative;
    line-height: 1.5rem;
    padding: 0 0.5rem;

    &:hover {
      background-color: rgba(4, 4, 5, 0.2);
    }

    & + .k-chat-message {
      margin-top: 0.5rem;
    }
  }

  .k-input {
    padding-top: 1rem;
    width: -webkit-fill-available;
  }
}

</style>
