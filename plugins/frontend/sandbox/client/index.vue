<template>
  <k-card-aside class="page-sandbox">
    <template #aside>
      <div class="card-header k-menu-item" @click="createUser">添加用户</div>
      <div class="user-container">
        <el-scrollbar>
          <k-tab-group :data="userMap" v-model="config.user" #="{ name }">
            <div class="avatar">{{ name[0] }}</div>
            <div class="nick">{{ name }}</div>
            <div class="close" @click="removeUser(name)">
              <k-icon name="times-full"></k-icon>
            </div>
          </k-tab-group>
        </el-scrollbar>
      </div>
    </template>
    <div class="card-header">
      <template v-for="(name, key) in panelTypes" :key="key">
        <span class="k-choose-item"
          :class="{ active: config.panelType === key }"
          @click="config.panelType = key">{{ name }}</span>
      </template>
    </div>
    <keep-alive>
      <k-empty key="empty" v-if="!users.length">
        <div>点击「添加用户」开始体验</div>
      </k-empty>
      <k-content :key="'profile' + channel" v-else-if="config.panelType === 'profile'">
        <k-form instant v-model="model" :schema="schema" :show-header="false"></k-form>
      </k-content>
      <template v-else :key="channel">
        <virtual-list :data="config.messages[channel] || []" #="data" pinned>
          <chat-message :data="data"></chat-message>
        </virtual-list>
        <div class="card-footer">
          <chat-input @send="sendMessage"></chat-input>
        </div>
      </template>
    </keep-alive>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { clone, message, send, Schema, store, ChatInput, VirtualList, deepEqual } from '@koishijs/client'
import { computed, ref, watch } from 'vue'
import { config, words, panelTypes } from './utils'
import ChatMessage from './message.vue'

const schema = Schema.object({
  authority: Schema.natural().description('权限等级').default(1),
})

const users = computed(() => {
  return Object
    .keys(config.messages)
    .filter(key => key.startsWith('@'))
    .map((key) => key.slice(1))
})

const userMap = computed(() => {
  return Object.fromEntries(users.value.map((name) => [name, { name }]))
})

const channel = computed(() => {
  if (config.panelType === 'guild') return '#'
  return '@' + config.user
})

const length = 10

function createUser() {
  if (users.value.length >= length) {
    return message.error('可创建的用户数量已达上限。')
  }
  let name: string
  do {
    name = words[config.index++]
    config.index %= length
  } while (users.value.includes(name))
  config.user = name
  config.messages['@' + name] = []
  send('sandbox/user', config.user, {})
}

function removeUser(name: string) {
  const index = users.value.indexOf(name)
  delete config.messages['@' + name]
  send('sandbox/user', config.user, null)
  if (config.user === name) {
    config.user = users.value[index] || ''
  }
}

const model = ref()

watch(() => store.users?.[config.user], (value) => {
  model.value = clone(value)
}, { immediate: true })

watch(model, (value) => {
  if (deepEqual(value, store.users?.[config.user])) return
  send('sandbox/user', config.user, value)
}, { deep: true })

function sendMessage(content: string) {
  send('sandbox/message', config.user, channel.value, content)
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

  .card-header {
    text-align: center;
    font-weight: bold;
    font-size: 1.15rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border);
  }

  .card-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
  }

  .user-container {
    overflow-y: auto;
  }

  .k-tab-item {
    padding: 0.75rem 1.5rem;
    display: flex;
    border-bottom: 1px solid var(--border);

    > .nick {
      line-height: 2.5rem;
      margin-left: 1.25rem;
      font-weight: 500;
      flex-grow: 1;
    }

    > .close {
      opacity: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      transition: opacity 0.3s ease;
    }

    &:hover > .close {
      opacity: 0.5;
      &:hover {
        opacity: 1;
      }
    }
  }
}

</style>
