<template>
  <k-chat-panel class="sandbox" :messages="messages" @enter="sendSandbox" :pinned="pinned">
    <template #default="{ from, content }">
      <p :class="from">
        <k-message :content="content"/>
      </p>
    </template>
  </k-chat-panel>
</template>

<script lang="ts" setup>

import { ref, watch } from 'vue'
import { send, receive, user, storage } from '~/client'

interface Message {
  from: 'user' | 'bot'
  content: string
}

const pinned = ref(true)
const messages = storage.create<Message[]>('sandbox', [])

watch(user, () => messages.value = [])

function addMessage(from: 'user' | 'bot', content: string) {
  pinned.value = from === 'bot'
  messages.value.push({ from, content })
}

function sendSandbox(content: string) {
  const { token, id } = user.value
  send('sandbox', { token, id, content })
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
  p {
    padding-left: 1rem;
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
}

</style>
