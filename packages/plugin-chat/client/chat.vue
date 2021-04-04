<template>
  <k-chat-panel class="page-chat" :messages="messages" pinned>
    <template #default="{ channelName, username, timestamp, content }">
      <div class="header">
        <span class="channel">{{ channelName || '私聊' }}</span>
        <span class="username">{{ username }}</span>
        <span class="timestamp">{{ formatDateTime(timestamp) }}</span>
      </div>
      <k-message :content="content"/>
    </template>
  </k-chat-panel>
</template>

<script lang="ts" setup>

import { receive, storage } from '~/client'

interface Message {
  username: string
  content: string
}

const messages = storage.create<Message[]>('chat', [])

receive('chat', (body) => {
  messages.value.push(body)
})

function formatDateTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  let output = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  if (date.toLocaleDateString() === now.toLocaleDateString()) return output
  output = `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${output}`
  if (date.getFullYear() === now.getFullYear()) return output
  return `${date.getFullYear()} 年 ${output}`
}

</script>

<style lang="scss">

.page-chat {
  .header {
    span {
      margin-right: 0.5rem;
    }
  }

  .username {
    font-weight: bold;
    line-height: 1.375rem;
  }

  .timestamp {
    color: #72767d;
  }
}

</style>
