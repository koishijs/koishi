<template>
  <div class="bot k-menu-item">
    <div class="avatar" :style="{ backgroundImage: `url(${data.avatar})` }" @click="$emit('avatar-click')">
      <el-tooltip :content="statusNames[data.status]">
        <div :class="['status', data.status, { error: data.error }]"></div>
      </el-tooltip>
    </div>
    <div class="info">
      <div><k-icon name="robot"/>{{ data.username }}</div>
      <div><k-icon name="layer-group"/>{{ data.platform }}</div>
      <div class="cur-frequency">
        <span style="margin-right: 8px">
          <k-icon name="arrow-up"/>
          <span>{{ data.messageSent }}/min</span>
        </span>
        <span>
          <k-icon name="arrow-down"/>
          <span>{{ data.messageReceived }}/min</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import type { Bot } from 'koishi'
import type { BotProvider } from '@koishijs/plugin-manager'

const statusNames: Record<Bot.Status, string> = {
  online: '运行中',
  offline: '离线',
  connect: '正在连接',
  reconnect: '正在重连',
  disconnect: '正在断开',
}

defineProps<{
  data: BotProvider.Data
}>()

</script>

<style scoped lang="scss">

div.bot {
  padding: 1rem 2rem;
  width: 16rem;
  display: flex;

  &.active {
    > div.avatar {
      border-color: var(--active);
    }
  }

  > div.avatar {
    position: relative;
    width: 80px;
    height: 80px;
    box-sizing: border-box;
    border: 2px solid var(--border);
    transition: border 0.3s ease;
    border-radius: 100%;
    background-size: 100%;
    background-repeat: no-repeat;
    transition: 0.1s ease;

    $borderWidth: 2px;

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

  > div.info {
    flex-grow: 1;
    margin-left: 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: space-around;

    .k-icon {
      width: 20px;
      margin-right: 6px;
      text-align: center;
      vertical-align: -2px;
    }
  }
}

</style>
