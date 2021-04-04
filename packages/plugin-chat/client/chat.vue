<template>
  <k-chat-panel class="sandbox" :messages="messages" pinned>
    <template #default="{ channelName, username, content }">
      <p>
        [{{ channelName || '私聊' }}] {{ username }}:
        <k-message :content="content"/>
      </p>
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

</script>
