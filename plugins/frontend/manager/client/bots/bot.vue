<template>
  <div class="bot k-menu-item" :class="[size]">
    <div class="avatar" :style="{ backgroundImage: `url(${data.avatar})` }" @click="$emit('avatar-click')">
      <el-tooltip :content="statusNames[data.status]">
        <div :class="['status', data.status, { error: data.error }]"></div>
      </el-tooltip>
    </div>
    <div class="content">
      <div><i class="fas fa-robot"/>{{ data.username }}</div>
      <div><i class="fas fa-boxes"/>{{ data.platform }}</div>
      <div v-if="size === 'large'"><i class="fas fa-robot"/> {{ data.selfId }}</div>
      <div class="cur-frequency">
        <span style="margin-right: 8px">
          <i class="fas fa-arrow-up"/>
          <span>{{ data.messageSent }}/min</span>
        </span>
        <span>
          <i class="fas fa-arrow-down"/>
          <span>{{ data.messageReceived }}/min</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import type { Bot } from 'koishi'
import type { BotProvider } from '@koishijs/plugin-manager/src'

const statusNames: Record<Bot.Status, string> = {
  online: '运行中',
  offline: '离线',
  connect: '正在连接',
  reconnect: '正在重连',
}

defineProps<{
  data: BotProvider.Data
  size?: 'large' | 'medium' | 'small'
}>()

</script>

<style scoped lang="scss">

div.bot {
  padding: 1rem 2rem;
  width: 16rem;
  display: flex;

  &.active {
    > div.avatar {
      border: 2px solid var(--primary);
      transition: border-color 0.3s ease;
    }
  }

  > div.avatar {
    position: relative;
    width: 80px;
    height: 80px;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 100%;
    background-size: 100%;
    background-repeat: no-repeat;
    transition: 0.1s ease;
    transition: border-color 0.3s ease;

    $borderWidth: 4px;

    > div.status {
      position: absolute;
      bottom: -$borderWidth;
      right: -$borderWidth;
      width: 1rem;
      height: 1rem;
      border-radius: 100%;
      border: $borderWidth solid var(--bg0);
      transition: background-color 0.3s ease, border-color 0.3s ease;

      &.online {
        background-color: var(--success);
      }
      &.connect, &.reconnect {
        background-color: var(--warning);
      }
      &.error {
        background-color: var(--error) !important;
      }
      &.offline {
        background-color: var(--disabled);
      }
    }
  }

  > div.content {
    flex-grow: 1;

    margin-left: 1.25rem;

    display: flex;
    flex-direction: column;
    justify-content: space-around;

    i {
      width: 20px;
      margin-right: 8px;
      text-align: center;
    }
  }

  &.large {
    padding: 10px;
    width: 600px; height: 360px;
  }
}
</style>
