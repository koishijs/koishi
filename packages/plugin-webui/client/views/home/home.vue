<template>
  <div class="card-grid profile-grid">
    <k-numeric title="当前消息频率" icon="paper-plane">{{ currentRate }} / min</k-numeric>
    <k-numeric title="近期消息频率" icon="history" v-if="config.database">{{ recentRate }} / d</k-numeric>
    <k-numeric title="数据库体积" icon="database" type="size" :value="meta.storageSize" v-if="meta" fallback="未安装"/>
    <k-numeric title="资源服务器" icon="hdd" type="size" :value="meta.assetSize" fallback="未安装"/>
    <k-numeric title="活跃用户数量" icon="heart" v-if="config.database">{{ meta.activeUsers }}</k-numeric>
    <k-numeric title="活跃群数量" icon="users" v-if="config.database">{{ meta.activeGroups }}</k-numeric>
  </div>
  <load-chart/>
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
  <div v-if="config.database" class="card-grid chart-grid">
    <history-chart/>
    <hour-chart/>
    <group-chart/>
    <command-chart/>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { stats, profile, meta } from '~/client'
import CommandChart from './command-chart.vue'
import GroupChart from './group-chart.vue'
import HistoryChart from './history-chart.vue'
import HourChart from './hour-chart.vue'
import LoadChart from './load-chart.vue'

const config = KOISHI_CONFIG

const codes = ['运行中', '闲置', '离线', '网络异常', '服务器异常', '封禁中', '尝试连接']

const currentRate = computed(() => {
  return profile.value.bots.reduce((sum, bot) => sum + bot.currentRate[0], 0)
})

const recentRate = computed(() => {
  return Object.values(stats.value.botSend).reduce((sum, value) => sum + value, 0).toFixed(1)
})

</script>

<style lang="scss">

</style>
