<template>
  <k-card-aside class="page-chat">
    <virtual-list :data="messages" pinned v-model:active-key="index">
      <template #header><div class="header-padding"></div></template>
      <template #="data">
        <chat-message @click="handleClick(data)" :successive="isSuccessive(data, data.index)" :data="data"></chat-message>
      </template>
      <template #footer><div class="footer-padding"></div></template>
    </virtual-list>
    <div class="card-footer">
      <chat-input @send="handleSend"></chat-input>
    </div>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { config, receive, send, ChatInput, VirtualList } from '@koishijs/client'
import { ref } from 'vue'
import type { Message } from '@koishijs/plugin-chat/src'
import { storage } from './utils'
import ChatMessage from './message.vue'

const pinned = ref(true)
const index = ref<string>()
const activeMessage = ref<Message>()
const messages = storage.create<Message[]>('chat', [])

receive('chat', (body) => {
  messages.value.push(body)
  messages.value.splice(0, messages.value.length - config.maxMessages)
})

function isSuccessive({ quote, userId, channelId }: Message, index: number) {
  const prev = messages.value[index - 1]
  return !quote && !!prev && prev.userId === userId && prev.channelId === channelId
}

function handleClick(message: Message) {
  activeMessage.value = message
}

function handleSend(content: string) {
  if (!activeMessage.value) return
  pinned.value = false
  const { platform, selfId, channelId, guildId } = activeMessage.value
  send('chat', { content, platform, selfId, channelId, guildId })
}

</script>

<style lang="scss">

.page-chat {
  position: relative;
  height: calc(100vh - 4rem);

  main {
    display: flex;
    flex-direction: column;
  }

  .header-padding, .footer-padding {
    padding: 0.5rem 0;
  }

  .card-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
  }
}

</style>
