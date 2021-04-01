<template>
  <k-card class="sandbox">
    <div class="history" ref="panel">
      <p v-for="({ from, content }, index) in messages" :key="index" :class="from">
        <k-message :text="content"/>
      </p>
    </div>
    <k-input v-model="text" @enter="onEnter" @paste="onPaste"></k-input>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, watch, nextTick, onMounted } from 'vue'
import { send, receive, user, storage, segment } from '~/client'

interface Message {
  from: 'user' | 'bot'
  content: string
}

const text = ref('')
const panel = ref<Element>(null)
const messages = storage.create<Message[]>('sandbox', [])

watch(user, () => messages.value = [])

function addMessage(from: 'user' | 'bot', content: string) {
  messages.value.push({ from, content })
  const { scrollTop, clientHeight, scrollHeight } = panel.value
  if (from === 'user' || Math.abs(scrollTop + clientHeight - scrollHeight) < 1) {
    nextTick(scrollToBottom)
  }
}

onMounted(scrollToBottom)

function scrollToBottom() {
  panel.value.scrollTop = panel.value.scrollHeight - panel.value.clientHeight
}

function sendSandbox(content: string) {
  const { token, id } = user.value
  send('sandbox', { token, id, content })
}

function onEnter() {
  if (!text.value) return
  sendSandbox(text.value)
  text.value = ''
}

async function onPaste(event) {
  const item = event.clipboardData.items[0]
  if (item.kind === 'file') {
    event.preventDefault()
    const file = item.getAsFile()
    const reader  = new FileReader()
    reader.addEventListener('load', function () {
      const { token, id } = user.value
      sendSandbox(segment.image('base64://' + reader.result.slice(22)))
    }, false)
    reader.readAsDataURL(file)
  }
}

receive('sandbox:bot', (data) => {
  addMessage('bot', data)
})

receive('sandbox:user', (data) => {
  addMessage('user', data)
})

receive('sandbox:clear', (data) => {
  messages.value = []
})

</script>

<style lang="scss">

.sandbox {
  height: 100%;
  position: relative;

  .history {
    position: absolute;
    top: 2rem;
    left: 2rem;
    right: 2rem;
    bottom: 6rem;
    overflow-x: visible;
    overflow-y: auto;
  }

  p {
    padding-left: 1rem;
    white-space: break-spaces;
    color: rgba(244, 244, 245, .8);
  }

  p:first-child {
    margin-top: 0;
  }
  p:last-child {
    margin-bottom: 0;
  }

  p.user::before {
    content: '>';
    position: absolute;
    left: -.1rem;
  }
  p.bot::before {
    content: '<';
    position: absolute;
    left: -.1rem;
  }

  .k-input {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    right: 2rem;
  }
}

</style>
