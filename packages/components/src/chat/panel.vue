<template>
  <div class="k-chat-panel">
    <k-virtual-list
      class="k-chat-body" :item-class="resolveItemClass"
      key-name="messageId" :data="messages" :pinned="pinned"
      @click="handleClick" :active-key="index">
      <template v-if="type === 'modern'" #default="message">
        <div class="quote" v-if="message.quote" @click="onClickQuote(message.quote.messageId)">
          <img class="quote-avatar" :src="message.quote.author.avatar"/>
          <span class="username">{{ message.quote.author.username }}</span>
          <span class="abstract">{{ formatAbstract(message.quote.abstract) }}</span>
        </div>
        <template v-if="isSuccessive(message, message.index)">
          <span class="timestamp">{{ formatTime(new Date(message.timestamp)) }}</span>
        </template>
        <template v-else>
          <img class="avatar" :src="message.avatar"/>
          <div class="header">
            <span class="channel">{{ message.channelName || '私聊' }}</span>
            <span class="username">{{ message.username }}</span>
            <span class="timestamp">{{ formatDateTime(new Date(message.timestamp)) }}</span>
          </div>
        </template>
        <k-chat-message :content="message.content"/>
      </template>
    </k-virtual-list>
    <div class="k-chat-footer">
      <slot name="footer"/>
      <k-input v-model="text" @enter="onEnter" @paste="onPaste"/>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { ref } from 'vue'
import { segment } from '@koishijs/core'
import { KInput, KVirtualList } from '../basic'
import KChatMessage from './message.vue'

type Type = 'compact' | 'modern' | 'casual'

export interface Message {
  avatar?: string
  content?: string
  abstract?: string
  username?: string
  nickname?: string
  platform?: string
  messageId?: string
  userId?: string
  channelId?: string
  groupId?: string
  selfId?: string
  channelName?: string
  groupName?: string
  timestamp?: number
  quote?: Message
}

const emit = defineEmits(['send'])

const props = withDefaults(defineProps<{
  messages: Message[]
  pinned?: boolean
  type?: Type
}>(), {
  type: 'modern',
})

const text = ref('')
const index = ref<string>()
const activeMessage = ref<Message>()

function resolveItemClass(item: any, index: number) {
  return 'k-chat-message' + (isSuccessive(item, index) ? ' successive' : '')
}

function onEnter() {
  if (!text.value) return
  emit('send', text.value)
  text.value = ''
}

async function onPaste(event: ClipboardEvent) {
  const item = event.clipboardData.items[0]
  if (item.kind === 'file') {
    event.preventDefault()
    const file = item.getAsFile()
    const reader  = new FileReader()
    reader.addEventListener('load', function () {
      emit('send', segment.image('base64://' + reader.result.slice(22)))
    }, false)
    reader.readAsDataURL(file)
  }
}

function isSuccessive({ quote, userId, channelId }: Message, index: number) {
  const prev = props.messages[index - 1]
  return !quote && prev && prev.userId === userId && prev.channelId === channelId
}

function handleClick(message: Message) {
  activeMessage.value = message
}

function onClickQuote(id: string) {
  index.value = id
}

function formatAbstract(content: string) {
  if (content.length < 50) return content
  return content.slice(0, 48) + '……'
}

function formatTime(date: Date) {
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

function formatDateTime(date: Date) {
  const now = new Date()
  let output = formatTime(date)
  if (date.toLocaleDateString() === now.toLocaleDateString()) return output
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${output}`
}

</script>

<style lang="scss">

$padding: 1.5rem;

.k-card.k-chat-panel {
  height: 100%;

  .k-card-body {
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  .k-chat-body {
    overflow-x: visible;
    overflow-y: auto;
    height: 100%;
  }

  .k-chat-footer {
    padding: 0 1rem;
  }

  .k-chat-message {
    position: relative;
    line-height: 1.5rem;
    padding: 0.25rem 1rem;

    &:hover {
      background-color: rgba(4, 4, 5, 0.2);
    }
  }

  .k-input {
    margin-top: 1rem;
    width: -webkit-fill-available;
  }
}

</style>
