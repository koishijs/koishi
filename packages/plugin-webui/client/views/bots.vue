<template>
  <k-card class="bot-table" title="账号数据">
    <table v-if="profile.bots.length">
      <tr>
        <th>平台名</th>
        <th>用户名</th>
        <th>运行状态</th>
        <th>当前消息频率</th>
        <th v-if="stats">近期消息频率</th>
      </tr>
      <tr v-for="{ platform, username, selfId, code, currentRate } in profile.bots">
        <td>{{ platform }}</td>
        <td>{{ username }}</td>
        <td>{{ codes[code] }}</td>
        <td>发送 {{ currentRate[0] }}/min，接收 {{ currentRate[1] }}/min</td>
        <td v-if="stats">发送 {{ stats.botSend[`${platform}:${selfId}`] || 0 }}/d，接收 {{ stats.botReceive[`${platform}:${selfId}`] || 0 }}/d</td>
      </tr>
    </table>
    <p v-else>暂无数据。</p>
  </k-card>
</template>

<script lang="ts" setup>

import { stats, profile } from '~/client'

const codes = ['运行中', '闲置', '离线', '网络异常', '服务器异常', '封禁中', '尝试连接']

</script>
