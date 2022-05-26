<template>
  <div class="chat-message" :class="{ successive }">
    <div class="quote" v-if="data.quote" @click="$emit('locate', data.quote.messageId)">
      <img class="quote-avatar" v-if="data.quote.author.avatar" :src="data.quote.author.avatar"/>
      <span class="username">{{ data.quote.author.username }}</span>
      <span class="abstract">{{ formatAbstract(data.quote.abstract) }}</span>
    </div>
    <template v-if="successive">
      <span class="timestamp">{{ formatTime(new Date(data.timestamp)) }}</span>
    </template>
    <template v-else>
      <img class="avatar" v-if="data.avatar" :src="data.avatar"/>
      <div class="header">
        <span class="username">{{ data.username }}</span>
        <span class="timestamp">{{ formatDateTime(new Date(data.timestamp)) }}</span>
      </div>
    </template>
    <message-content :content="data.content">
      <template #image="{ url }">
        <chat-image :src="url"></chat-image>
      </template>
    </message-content>
  </div>
</template>

<script lang="ts" setup>

import { Message } from '@koishijs/plugin-chat/src'
import { MessageContent, ChatImage } from '@koishijs/client'

defineEmits(['locate'])

defineProps<{
  data: Message
  successive: boolean
}>()

function formatAbstract(content: string) {
  if (content.length < 50) return content
  return content.slice(0, 48) + '……'
}

function formatTime(date: Date) {
  if (Number.isNaN(+date)) return ''
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

function formatDateTime(date: Date) {
  if (Number.isNaN(+date)) return ''
  const now = new Date()
  let output = formatTime(date)
  if (date.toLocaleDateString() === now.toLocaleDateString()) return output
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${output}`
}

</script>

<style lang="scss" scoped>

$avatarSize: 2.5rem;
$padding: $avatarSize + 1rem;

.chat-message {
  position: relative;
  padding: 0 1.5rem;
  word-break: break-word;

  &:hover {
    background-color: var(--hover-bg);;
  }

  &:not(.successive) {
    margin-top: 0.5rem;
  }

  :deep(.message-content) {
    margin-left: $padding;
  }

  &.successive {
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
    * + span {
      margin-left: 0.5rem;
    }
  }

  .username {
    font-weight: bold;
    line-height: 1.375rem;
  }

  .timestamp {
    color: #72767d;
    font-size: 0.75rem;
  }
}

</style>
