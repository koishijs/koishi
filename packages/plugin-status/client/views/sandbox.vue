<template>
  <k-card class="sandbox">
    <div class="history">
      <p v-for="({ from, content }, index) in messages" :key="index" :class="from">
        {{ content }}
      </p>
    </div>
    <k-input v-model="text" @enter="onEnter"></k-input>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, reactive } from 'vue'
import { send, receive, user } from '~/client'

interface Message {
  from: 'user' | 'bot'
  content: string
}

const text = ref('')
const messages = reactive<Message[]>([])

function onEnter() {
  if (!text.value) return
  messages.push({ from: 'user', content: text.value })
  const { token, id } = user.value
  send('sandbox', { token, id, content: text.value })
  text.value = ''
}

receive('sandbox', (data) => {
  messages.push({ from: 'bot', content: data })
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
