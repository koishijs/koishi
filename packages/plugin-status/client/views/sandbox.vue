<template>
  <k-card class="sandbox">
    <div class="history" ref="panel">
      <p v-for="({ from, content }, index) in messages" :key="index" :class="from">
        {{ content }}
      </p>
    </div>
    <k-input v-model="text" @enter="onEnter"></k-input>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, reactive, nextTick } from 'vue'
import { send, receive, user } from '~/client'

interface Message {
  from: 'user' | 'bot'
  content: string
}

const text = ref('')
const panel = ref<Element>(null)
const messages = reactive<Message[]>([])

function addMessage(from: 'user' | 'bot', content: string) {
  messages.push({ from, content })
  const { scrollTop, clientHeight, scrollHeight } = panel.value
  if (Math.abs(scrollTop + clientHeight - scrollHeight) < 1) {
    nextTick(scrollToBottom)
  }
}

function scrollToBottom() {
  panel.value.scrollTop = panel.value.scrollHeight - panel.value.clientHeight
}

function onEnter() {
  if (!text.value) return
  addMessage('user', text.value)
  const { token, id } = user.value
  send('sandbox', { token, id, content: text.value })
  text.value = ''
}

receive('sandbox', (data) => {
  addMessage('bot', data)
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
