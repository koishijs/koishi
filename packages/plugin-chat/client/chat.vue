<template>
  <k-chat-panel class="page-chat" :messages="messages" pinned @click="handleClick" @send="handleSend">
    <template #default="{ avatar, channelName, username, timestamp, content }">
      <img class="avatar" :src="avatar"/>
      <div class="header">
        <span class="channel">{{ channelName || '私聊' }}</span>
        <span class="username">{{ username }}</span>
        <span class="timestamp">{{ formatDateTime(timestamp) }}</span>
      </div>
      <k-message :content="content"/>
    </template>
    <template #footer v-if="activeMessage">
      发送到频道：{{ activeMessage.channelName }}
    </template>
  </k-chat-panel>
</template>

<script lang="ts" setup>

import { receive, storage, send, user } from '~/client'
import { ref } from 'vue'
import type { Message } from '../src'

const pinned = ref(true)
const activeMessage = ref<Message>()
const messages = storage.create<Message[]>('chat', [])

receive('chat', (body) => {
  messages.value.push(body)
})

function handleClick(message: Message) {
  activeMessage.value = message
}

function handleSend(content: string) {
  if (!activeMessage.value) return
  pinned.value = false
  const { platform, selfId, channelId } = activeMessage.value
  const { token, id } = user.value
  send('chat', { token, id, content, platform, selfId, channelId })
}

function formatDateTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  let output = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  if (date.toLocaleDateString() === now.toLocaleDateString()) return output
  output = `${date.getMonth() + 1}-${date.getDate()} ${output}`
  if (date.getFullYear() === now.getFullYear()) return output
  return `${date.getFullYear()}-${output}`
}

</script>

<style lang="scss">

$avatarSize: 2.5rem;

.page-chat {
  .avatar {
    position: absolute;
    margin-top: 4px;
    width: $avatarSize;
    height: $avatarSize;
    border-radius: $avatarSize;
  }

  .header {
    padding-left: $avatarSize + 1rem;
    color: #72767d;
    span {
      margin-right: 0.5rem;
    }
  }

  .username {
    color: rgba(244, 244, 245, 0.8);
    font-weight: bold;
    line-height: 1.375rem;
  }

  .timestamp {
    color: #72767d;
  }

  .k-message {
    padding-left: $avatarSize + 1rem;
  }
}

</style>
