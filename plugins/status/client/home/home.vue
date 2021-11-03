<template>
  <div class="card-grid profile-grid">
    <k-numeric title="当前消息频率" icon="paper-plane">{{ currentRate }} / min</k-numeric>
    <k-numeric title="近期消息频率" icon="history" v-if="config.database">{{ recentRate }} / d</k-numeric>
    <k-numeric title="数据库体积" icon="database" type="size" :value="storageSize" fallback="未安装"/>
    <k-numeric title="资源服务器" icon="hdd" type="size" :value="store.meta.assetSize" fallback="未安装"/>
    <k-numeric title="活跃用户数量" icon="heart" v-if="config.database">{{ store.meta.activeUsers }}</k-numeric>
    <k-numeric title="活跃群数量" icon="users" v-if="config.database">{{ store.meta.activeGroups }}</k-numeric>
  </div>
  <load-chart/>
  <div v-if="config.database" class="card-grid chart-grid">
    <history-chart/>
    <hour-chart/>
    <group-chart/>
    <command-chart/>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { store } from '~/client'
import CommandChart from './command-chart.vue'
import GroupChart from './group-chart.vue'
import HistoryChart from './history-chart.vue'
import HourChart from './hour-chart.vue'
import LoadChart from './load-chart.vue'
import type {} from '@koishijs/plugin-manager/src'

const config = KOISHI_CONFIG

const currentRate = computed(() => {
  return store.value.bots.reduce((sum, bot) => sum + bot.messageSent, 0)
})

const recentRate = computed(() => {
  return Object.values(store.value.stats.botSend).reduce((sum, value) => sum + value, 0).toFixed(1)
})

const storageSize = computed(() => {
  return Object.values(store.value.meta.tables || {}).reduce((prev, curr) => prev + curr.size, 0)
})

</script>

<style lang="scss">

</style>
