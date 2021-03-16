<template>
  <k-card v-if="status" class="bot-table" title="账号数据">
    <table v-if="status.bots.length">
      <tr>
        <th>平台名</th>
        <th>用户名</th>
        <th>运行状态</th>
        <th>当前消息频率</th>
        <th>近期消息频率</th>
      </tr>
      <tr v-for="(bot, index) in status.bots" :key="index">
        <td>{{ bot.platform }}</td>
        <td>{{ bot.username }}</td>
        <td>{{ codes[bot.code] }}</td>
        <td>发送 {{ bot.currentRate[0] }}/min，接收 {{ bot.currentRate[1] }}/min</td>
        <td>发送 {{ bot.recentRate[0] }}/d，接收 {{ bot.recentRate[1] }}/d</td>
      </tr>
    </table>
    <p v-else>暂无数据。</p>
  </k-card>
</template>

<script lang="ts" setup>

import { status } from '~/client'
import { defineProps } from 'vue'

const codes = ['运行中', '闲置', '离线', '网络异常', '服务器异常', '封禁中', '尝试连接']

</script>

<style lang="scss">

.bot-table {
  table {
    text-align: center;
    width: 100%;
    border-collapse: collapse;
  }

  tr {
    transition: 0.3s ease;
  }

  tr:hover {
    background-color: #474d8450;
  }

  td, th {
    padding: .6em 1em;
    border-bottom: 1px solid #040620;
  }

  th {
    border-top: 1px solid #040620;
  }
}

</style>
