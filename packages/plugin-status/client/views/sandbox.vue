<template>
  <k-card class="sandbox">
    <div class="history">
      <p v-for="({ from, content }, index) in messages" :key="index">
        <span class="hint">{{ from === 'user' ? '>' : '<' }}</span>
        {{ content }}
      </p>
    </div>
    <k-input v-model="text" @enter="onEnter"></k-input>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, reactive } from 'vue'
import { send, receive } from '~/client'

interface Message {
  from: 'user' | 'bot'
  content: string
}

const text = ref('')
const messages = reactive<Message[]>([])

function onEnter() {
  if (!text.value) return
  messages.push({ from: 'user', content: text.value })
  send('sandbox', text.value)
  text.value = ''
}

receive('sandbox', (data) => {
  messages.push({ from: 'bot', content: data })
})

</script>

<style lang="scss">

.sandbox {
  height: 100%;
  .k-input {
    width: 100%;
  }
}

</style>
