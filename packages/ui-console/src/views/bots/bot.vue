<template>
  <div class="bot" :class="[size]">
    <div class="avatar" :style="{ backgroundImage: `url(${data.avatar})` }" @click="$emit('avatar-click')">
      <el-tooltip :content="statusNames[data.code]">
        <div class="status" :level="data.code"></div>
      </el-tooltip>
    </div>
    <div class="content">
      <div><i class="fas fa-robot"/>{{ data.username }}</div>
      <div><i class="fas fa-boxes"/>{{ data.platform }}</div>
      <div v-if="size === 'large'"><i class="fas fa-robot"/> {{ data.selfId }}</div>
      <div class="cur-frequency">
        <span style="margin-right: 8px">
          <i class="fas fa-arrow-up"/>
          <span>{{ data.currentRate[0] }}/min</span>
        </span>
        <span>
          <i class="fas fa-arrow-down"/>
          <span>{{ data.currentRate[1] }}/min</span>
        </span>
      </div>
      <div v-if="stats" class="recent-frequency">
        <span title="发送"
              style="margin-right: 5px">
          <i class="fas fa-paper-plane"/>
          {{stats.botReceive[`${data.platform}:${data.selfId}`] || 0}}/min
        </span>
        <span title="接收">
          <i class="fas fa-paper-plane"
             style="transform: rotateX(180deg)"/>
          {{stats.botSend[`${data.platform}:${data.selfId}`] || 0}}/min
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { stats } from '~/client'
import type { BotData } from '~/server'

const statusNames = ['运行中', '闲置', '离线', '网络异常', '服务器异常', '封禁中', '尝试连接']

defineProps<{
  data: BotData,
  size?: 'large' | 'medium' | 'small'
}>()

</script>

<style scoped lang="scss">

@import '~/variables';

div.bot {
  padding: 1rem 2rem;
  width: 16rem;
  display: flex;

  @include button-like;

  &.active {
    > div.avatar {
      border: 2px solid var(--primary);
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

    > div.status {
      $border-width: 4px;
      position: absolute;
      bottom: -$border-width;
      right: -$border-width;
      width: 1rem;
      height: 1rem;
      border-radius: 100%;
      border: $border-width solid var(--bg0);

      // '运行中' '闲置' '离线' '网络异常' '服务器异常' '封禁中' '尝试连接'
      &[level="0"] {
        background-color: var(--success);
      }
      &[level="1"] {
        background-color: var(--warning);
      }
      &[level="2"] {
        background-color: var(--error);
      }
      &[level="3"] {
        background-color: var(--error-dark);
      }
      &[level="4"] {
        background-color: var(--error-dark);
      }
      &[level="5"] {
        background-color: var(--warning-dark);
      }
      &[level="6"] {
        background-color: var(--warning-light);
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
