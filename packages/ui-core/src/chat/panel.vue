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
          <img v-if="message.avatar" class="avatar" :src="message.avatar"/>
          <div v-else class="avatar">{{ message.username[0] }}</div>
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

.k-chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

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
      background-color: var(--c-chat-hover);
    }
  }

  .k-input {
    margin: 1rem 0;
    width: 100%;
  }

  $avatarSize: 2.5rem;
  $padding: $avatarSize + 1rem;

  .successive {
    margin-top: -0.5rem;

    .timestamp {
      position: absolute;
      visibility: hidden;
      left: 0;
      width: $padding + 1rem;
      text-align: center;
      user-select: none;
    }

    &:hover {
      .timestamp {
        visibility: initial;
      }
    }
  }

  .avatar {
    position: absolute;
    margin-top: 4px;
    width: $avatarSize;
    height: $avatarSize;
    border-radius: $avatarSize;
    user-select: none;
    font-family: "Comic Sans MS";
    text-align: center;
    line-height: $avatarSize;
    font-size: 1.3rem;
    color: var(--c-bg);
    background-color: var(--c-brand);
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
    font-size: 0.75rem;
  }

  .k-message {
    margin-left: $padding;
  }
}

</style>
