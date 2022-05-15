<template>
  <k-card-aside class="page-chat">
    <template #aside>
      <el-scrollbar>
        <template v-for="({ name, channels }, id) in guilds" :key="id">
          <div class="k-tab-group-title">{{ name }}</div>
          <template v-for="({ name }, key) in channels" :key="key">
            <k-tab-item v-model="current" :label="id + ':' + key">
              {{ name }}
            </k-tab-item>
          </template>
        </template>
      </el-scrollbar>
    </template>
    <keep-alive #default>
      <template v-if="current" :key="current">
        <div class="card-header">{{ header }}</div>
        <virtual-list :data="filtered" pinned v-model:active-key="index" key-name="messageId">
          <template #header><div class="header-padding"></div></template>
          <template #="data">
            <chat-message :successive="isSuccessive(data, data.index)" :data="data"></chat-message>
          </template>
          <template #footer><div class="footer-padding"></div></template>
        </virtual-list>
        <div class="card-footer">
          <chat-input @send="handleSend"></chat-input>
        </div>
      </template>
      <template v-else>
        <k-empty>
          <div>请在左侧选择频道</div>
        </k-empty>
      </template>
    </keep-alive>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { config, receive, send, ChatInput, VirtualList } from '@koishijs/client'
import { computed, ref } from 'vue'
import type { Dict } from 'cosmokit'
import type { Message } from '@koishijs/plugin-chat/src'
import { storage } from './utils'
import ChatMessage from './message.vue'

const pinned = ref(true)
const index = ref<string>()
const messages = storage.create<Message[]>('chat', [])
const current = ref<string>('')

receive('chat', (body) => {
  messages.value.push(body)
  messages.value.splice(0, messages.value.length - config.maxMessages)
})

const guilds = computed(() => {
  const guilds: Dict<{
    name: string
    channels: Dict<{ name: string }>
  }> = { '': { name: '私聊', channels: {} } }
  for (const message of messages.value) {
    const guild = guilds[message.platform + ':' + message.guildId] ||= {
      name: message.guildName || '未知群组',
      channels: {},
    }
    guild.channels[message.channelId] ||= {
      name: message.channelName,
    }
  }
  return guilds
})

const header = computed(() => {
  if (!current.value) return
  const [platform, guildId, channelId] = current.value.split(':')
  const guild = guilds.value[platform + ':' + guildId]
  if (!guild) return
  return `${guild.name} / ${guild.channels[channelId]?.name}`
})

const filtered = computed(() => {
  if (!current.value) return []
  const [platform, guildId, channelId] = current.value.split(':')
  return messages.value.filter((data) => {
    return data.platform === platform && data.guildId === guildId && data.channelId === channelId
  })
})

function isSuccessive({ quote, userId, channelId }: Message, index: number) {
  const prev = messages.value[index - 1]
  return !quote && !!prev && prev.userId === userId && prev.channelId === channelId
}

function handleSend(content: string) {
  if (!current.value) return
  const [platform, guildId, channelId] = current.value.split(':')
  send('chat', { content, platform, channelId, guildId })
}

</script>

<style lang="scss">

.page-chat {
  position: relative;
  height: calc(100vh - 4rem);

  aside .el-scrollbar__view {
    padding: 1rem 0;
    line-height: 2.25rem;
  }

  main {
    display: flex;
    flex-direction: column;
  }

  .card-header {
    font-size: 1.05rem;
    font-weight: 500;
    padding: 0 1.25rem;
    height: 3.5rem;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }

  .header-padding, .footer-padding {
    padding: 0.25rem 0;
  }

  .card-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
  }
}

</style>
