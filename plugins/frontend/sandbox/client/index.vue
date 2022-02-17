<template>
  <k-card-aside class="page-sandbox">
    <template #aside>
      <div class="header k-menu-item" :class="{ active: user === '' }" @click="user = ''">添加用户</div>
      <div class="user-container">
        <el-scrollbar>
          <k-tab-group :data="data" v-model="user" #="{ name }">
            <div class="avatar">{{ name[0] }}</div>
            <div class="info">{{ name }}</div>
          </k-tab-group>
        </el-scrollbar>
      </div>
    </template>
    <div class="header">
      <span class="k-choose-item" :class="{ active: config.isPrivate }" @click="config.isPrivate = true">私聊模式</span>
      <span class="k-choose-item" :class="{ active: !config.isPrivate }" @click="config.isPrivate = false">群聊模式</span>
    </div>
    <keep-alive>
      <k-chat-panel class="sandbox" :key="channel" :messages="config.messages[channel] || []" @send="sendMessage" #="data">
        <chat-message :data="data"></chat-message>
      </k-chat-panel>
    </keep-alive>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { send } from '@koishijs/client'
import { computed, ref } from 'vue'
import { config, names } from './utils'
import ChatMessage from './message.vue'

const data = Object.fromEntries(names.map(name => [name, {name}]))

const user = ref<string>('')
const channel = computed(() => config.isPrivate ? user.value : '#')

function sendMessage(content: string) {
  send('sandbox/message', user.value, channel.value, content)
}

</script>

<style lang="scss">

.page-sandbox {
  --avatar-size: 2.5rem;

  aside, main {
    display: flex;
    flex-direction: column;
  }

  .avatar {
    border-radius: 100%;
    background-color: var(--primary);
    transition: 0.3s ease;
    width: var(--avatar-size);
    height: var(--avatar-size);
    line-height: var(--avatar-size);
    font-size: 1.25rem;
    text-align: center;
    font-weight: 400;
    color: #fff;
    font-family: Comic Sans MS;
    user-select: none;
  }

  .k-chat-panel {
    height: 100%;
  }

  .header, .footer {
    font-size: 1.15rem;
    text-align: center;
    padding: 1rem 0;
    font-weight: bold;
  }

  .header {
    border-bottom: 1px solid var(--border);
  }

  .footer {
    border-top: 1px solid var(--border);
  }

  .user-container {
    overflow-y: auto;
  }

  .k-tab-item {
    padding: 0.75rem 2rem;
    display: flex;

    > .info {
      line-height: 2.5rem;
      margin-left: 1.25rem;
      font-weight: 500;
    }

    & + .k-tab-item {
      border-top: 1px solid var(--border);
    }
  }
}

</style>
