<template>
  <k-card class="sandbox">
    <div class="history" ref="panel">
      <p v-for="({ username, content }, index) in messages" :key="index">
        {{ username }}: {{ content }}
      </p>
    </div>
    <k-input v-model="text" @enter="onEnter"></k-input>
  </k-card>
</template>

<script lang="ts" setup>

import { receive, storage, send } from '~/client'
import { ref, nextTick } from 'vue'

interface Message {
  username: string
  content: string
}

const text = ref('')
const panel = ref<Element>(null)
const messages = storage.create<Message[]>('chat', [])

function addMessage(body: Message) {
  messages.value.push(body)
  const { scrollTop, clientHeight, scrollHeight } = panel.value
  if (Math.abs(scrollTop + clientHeight - scrollHeight) < 1) {
    nextTick(scrollToBottom)
  }
}

function scrollToBottom() {
  panel.value.scrollTop = panel.value.scrollHeight - panel.value.clientHeight
}

receive('message', addMessage)

function onEnter() {
  if (!text.value) return
  // addMessage('user', text.value)
  // const { token, id } = user.value
  // send('chat', { token, id, content: text.value })
  // text.value = ''
}

</script>
