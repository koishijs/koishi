<template>
  <el-card class="bot-table" header="账号数据" shadow="hover">
    <table>
      <tr>
        <th>账号信息</th>
        <th>消息频率</th>
      </tr>
      <tr v-for="(bot, index) in bots" :key="index">
        <td>{{ bot.username }} ({{ bot.platform }}:{{ bot.selfId }})</td>
        <td>接收 {{ bot.received }}/min，发送 {{ bot.sent }}/min</td>
      </tr>
    </table>
  </el-card>
</template>

<script lang="ts" setup>

import type { BotData } from '@/server'
import { defineProps } from 'vue'

const { bots } = defineProps<{ bots: BotData[] }>()

</script>

<style lang="scss">

.bot-table {
  .el-card__body {
    padding: 0;
  }

  table {
    text-align: center;
    width: 100%;
    border-collapse: collapse;
  }

  tr {
    transition: 0.3s ease;
  }

  tr:hover {
    background-color: #f6f8fa;
  }

  td, th {
    padding: .6em 1em;
    border-bottom: 1px solid #ebeef5;
  }

  tr:last-child td {
    border-bottom: none;
  }
}

</style>
