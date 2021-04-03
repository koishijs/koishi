<template>
  <k-chat-panel class="sandbox" :messages="messages">
    <template #default="{ username, content }">
      <p>
        {{ username }}: <k-message :content="content"/>
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
