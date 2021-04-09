<template>
  <k-chat-panel class="page-chat" :messages="messages" pinned @click="handleClick" @send="handleSend" :item-class="getItemClass">
    <template #default="{ avatar, messageId, channelName, username, timestamp, content, quote }">
      <div class="quote" v-if="quote" @click="onClickQuote(quote.messageId)">
        <img class="quote-avatar" :src="quote.author.avatar"/>
        <span class="username">{{ quote.author.username }}</span>
        <span class="abstract">{{ formatAbstract(quote.abstract) }}</span>
      </div>
      <img class="avatar" :src="avatar"/>
      <div class="header" :ref="el => divs[messageId] = el?.['parentElement']">
        <span class="channel">{{ channelName || '私聊' }}</span>
        <span class="username">{{ username }}</span>
        <span class="timestamp">{{ formatDateTime(timestamp) }}</span>
      </div>
      <k-message :content="content"/>
    </template>
    <template #footer>
      <p class="hint">
        <template v-if="activeMessage">发送到频道：{{ activeMessage.channelName }}</template>
        <template v-else>点击消息已选择要发送的频道。</template>
      </p>
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
const divs = ref<Record<string, HTMLElement>>({})

receive('chat', (body) => {
  messages.value.push(body)
})

function getItemClass({ quote, userId }: Message, index: number) {
  const prev = messages.value[index - 1]
  if (quote || prev?.userId !== userId) return 'k-chat-message'
  return 'k-chat-message successive'
}

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

function onClickQuote(id: string) {
  const el = divs.value[id]
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth' })
}

function formatAbstract(content: string) {
  if (content.length < 50) return content
  return content.slice(0, 48) + '……'
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
$padding: $avatarSize + 1rem;

.page-chat {
  position: relative;

  .successive {
    margin-top: -0.5rem;
    .avatar, .header {
      display: none;
    }
  }

  .avatar {
    position: absolute;
    margin-top: 4px;
    width: $avatarSize;
    height: $avatarSize;
    border-radius: $avatarSize;
    user-select: none;
  }

  .quote {
    position: relative;
    font-size: 0.875rem;
    margin-left: $padding;
    cursor: pointer;
    * + span {
      margin-left: 0.5rem;
    }

    &::before {
      content: '';
      display: block;
      position: absolute;
      box-sizing: border-box;
      top: 50%;
      right: 100%;
      bottom: 0;
      left: -36px;
      margin-right: 4px;
      margin-top: -1px;
      margin-left: -1px;
      margin-bottom: calc(.125rem - 4px);
      border-left: 1px solid #4f545c;
      border-top: 1px solid #4f545c;
      border-top-left-radius: 6px;
    }

    .quote-avatar {
      width: 1rem;
      height: 1rem;
      border-radius: 1rem;
      vertical-align: text-top;
    }

    .abstract {
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .header {
    margin-left: $padding;
    color: #72767d;
    * + span {
      margin-left: 0.5rem;
    }
  }

  .username {
    color: rgba(244, 244, 245, 0.8);
    font-weight: bold;
    line-height: 1.375rem;
  }

  .timestamp {
    color: #72767d;
    font-size: 0.875rem;
  }

  .k-message {
    margin-left: $padding;
  }

  p.hint {
    color: #72767d;
    margin: 0.5rem 0 -0.5rem;
  }
}

</style>
