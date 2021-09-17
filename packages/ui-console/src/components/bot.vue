<template>
  <div class="bot" :class="[size]">
    <div class="avatar" :style="{
      'background-image': `url(${modelValue.avatar})`
    }" @click="$emit('avatar-click')">
      <el-tooltip :content="statusNames[modelValue.code]">
        <div class="status"><div class="circle" :level="modelValue.code"/></div>
      </el-tooltip>
    </div>
    <div class="content">
      <div><i class="fas fa-robot"/> {{ modelValue.username }}</div>
      <div><i class="fas fa-boxes"/> {{ modelValue.platform }}</div>
      <div v-if="size === 'large'"><i class="fas fa-robot"/> {{ modelValue.selfId }}</div>
      <div class="cur-frequency">
        <span title="发送"
              style="margin-right: 5px">
          <i class="fas fa-arrow-up"/>
          {{modelValue.currentRate[0]}}/min
        </span>
        <span title="接收">
          <i class="fas fa-arrow-down"/>
          {{modelValue.currentRate[1]}}/min
        </span>
      </div>
      <div v-if="stats" class="recent-frequency">
        <span title="发送"
              style="margin-right: 5px">
          <i class="fas fa-paper-plane"/>
          {{stats.botReceive[`${modelValue.platform}:${modelValue.selfId}`] || 0}}/min
        </span>
        <span title="接收">
          <i class="fas fa-paper-plane"
             style="transform: rotateX(180deg)"/>
          {{stats.botSend[`${modelValue.platform}:${modelValue.selfId}`] || 0}}/min
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { stats } from '~/client'
import type { BotData } from '@koishijs/plugin-status'

const statusNames = ['运行中', '闲置', '离线', '网络异常', '服务器异常', '封禁中', '尝试连接']
defineProps<{
  modelValue: BotData,
  size?: 'large' | 'medium' | 'small'
}>()
defineEmits(['avatar-click'])

</script>

<style scoped lang="scss">
div.bot {
  padding: 10px;
  width: 300px; height: 100px;

  display: flex;
  > div.avatar {
    position: relative;
    width: 100px; height: 100px;
    border: 1px solid #ddd;
    border-radius: 100%;
    background: {
      size: 100%;
      repeat: no-repeat;
      color: #151820;
    };
    cursor: pointer;
    transition: .3s;

    &:hover {
      box-shadow: 0 0 16px 4px lightgray;
    }
    > div.status {
      position: absolute;
      bottom: 0; right: 0;
      width: 30px; height: 30px;
      border-radius: 100%;
      background-color: var(--bg0);

      font-size: 12px;

      display: flex;
      align-items: center;

      > div.circle {
        margin: 5px;
        width: 20px; height: 20px;
        border-radius: 100%;

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
  }
  > div.content {
    flex-grow: 1;

    margin-left: 20px;

    display: flex;
    flex-direction: column;
    justify-content: space-around;
    > div.name { }
    i.fas {
      width: 20px;
      text-align: center;
    }
  }
  &.large {
    padding: 10px;
    width: 600px; height: 360px;
  }
}
</style>
